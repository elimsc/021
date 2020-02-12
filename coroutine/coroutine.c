#include "coroutine.h"
#include <stdio.h>
#include <stdlib.h>
#include <assert.h>
#include <stddef.h>
#include <string.h>
#include <stdint.h>

#if __APPLE__ && __MACH__
#include <sys/ucontext.h>
#else
#include <ucontext.h> // search setcontext for usage
#endif

#define STACK_SIZE (1024 * 1024)
#define DEFAULT_COROUTINE 16

struct coroutine;

/* 协程组 */
struct schedule
{
	char stack[STACK_SIZE];
	ucontext_t main;
	int nco;			   // 协程组内协程个数
	int cap;			   // 协程组协程容量
	int running;		   // 当前运行的协程
	struct coroutine **co; // S->co[i] 获得组内第i个协程
};

/* 协程 */
struct coroutine
{
	coroutine_func func;  // coroutine对应的函数
	void *ud;			  // 函数参数
	ucontext_t ctx;		  //
	struct schedule *sch; // 当前coroutine所在协程组
	ptrdiff_t cap;		  //
	ptrdiff_t size;		  //
	int status;			  // 当前状态 DEAD, READY, RUNNING, SUSPEND
	char *stack;
};

/* 新建一个协程，func为函数，ud为函数参数 */
struct coroutine *_co_new(struct schedule *S, coroutine_func func, void *ud)
{
	struct coroutine *co = malloc(sizeof(*co));
	co->func = func;
	co->ud = ud;
	co->sch = S;
	co->cap = 0;
	co->size = 0;
	co->status = COROUTINE_READY;
	co->stack = NULL;
	return co;
}

void _co_delete(struct coroutine *co)
{
	free(co->stack);
	free(co);
}

/* 新建一个协程组 */
struct schedule *coroutine_open(void)
{
	struct schedule *S = malloc(sizeof(*S));
	S->nco = 0;
	S->cap = DEFAULT_COROUTINE; // 设置当前协程组能容纳的协程容量为16
	S->running = -1;
	S->co = malloc(sizeof(struct coroutine *) * S->cap);
	memset(S->co, 0, sizeof(struct coroutine *) * S->cap);
	return S;
}

/* 关闭协程组 */
void coroutine_close(struct schedule *S)
{
	int i;
	for (i = 0; i < S->cap; i++)
	{
		struct coroutine *co = S->co[i];
		if (co)
		{
			_co_delete(co);
		}
	}
	free(S->co);
	S->co = NULL;
	free(S);
}

/**
 * 将新建的协程放入到协程组
 * 返回值为当前协程在协程组中的下标
 */
int coroutine_new(struct schedule *S, coroutine_func func, void *ud)
{
	struct coroutine *co = _co_new(S, func, ud);
	if (S->nco >= S->cap) // 协程个数达到最大容量，则扩展最大容量为原来的2倍
	{
		int id = S->cap;
		S->co = realloc(S->co, S->cap * 2 * sizeof(struct coroutine *));
		memset(S->co + S->cap, 0, sizeof(struct coroutine *) * S->cap);
		S->co[S->cap] = co;
		S->cap *= 2;
		++S->nco;
		return id;
	}
	else
	{
		int i;
		for (i = 0; i < S->cap; i++)
		{
			int id = (i + S->nco) % S->cap;
			if (S->co[id] == NULL)
			{
				S->co[id] = co;
				++S->nco;
				return id;
			}
		}
	}
	assert(0);
	return -1;
}

static void mainfunc(uint32_t low32, uint32_t hi32)
{
	uintptr_t ptr = (uintptr_t)low32 | ((uintptr_t)hi32 << 32);
	struct schedule *S = (struct schedule *)ptr;
	int id = S->running;
	struct coroutine *C = S->co[id];
	C->func(S, C->ud);
	_co_delete(C);
	S->co[id] = NULL;
	--S->nco;
	S->running = -1;
}

/* 执行一个协程 */
void coroutine_resume(struct schedule *S, int id)
{
	assert(S->running == -1);
	assert(id >= 0 && id < S->cap);
	struct coroutine *C = S->co[id];
	if (C == NULL)
		return;

	int status = C->status;
	switch (status)
	{
	case COROUTINE_READY:
		getcontext(&C->ctx);				  // 保持当前进程的上下文信息到 C->ctx
		C->ctx.uc_stack.ss_sp = S->stack;	 // 栈指针
		C->ctx.uc_stack.ss_size = STACK_SIZE; // 栈大小
		C->ctx.uc_link = &S->main;			  // 与协程关联的协程组
		S->running = id;
		C->status = COROUTINE_RUNNING;
		uintptr_t ptr = (uintptr_t)S;
		makecontext(&C->ctx, (void (*)(void))mainfunc, 2, (uint32_t)ptr, (uint32_t)(ptr >> 32));
		swapcontext(&S->main, &C->ctx);
		break;
	case COROUTINE_SUSPEND:
		memcpy(S->stack + STACK_SIZE - C->size, C->stack, C->size);
		S->running = id;
		C->status = COROUTINE_RUNNING;
		swapcontext(&S->main, &C->ctx);
		break;
	default:
		assert(0);
	}
}

static void _save_stack(struct coroutine *C, char *top)
{
	char dummy = 0;
	assert(top - &dummy <= STACK_SIZE);
	if (C->cap < top - &dummy)
	{
		free(C->stack);
		C->cap = top - &dummy;
		C->stack = malloc(C->cap);
	}
	C->size = top - &dummy;
	memcpy(C->stack, &dummy, C->size);
}

void coroutine_yield(struct schedule *S)
{
	int id = S->running;
	assert(id >= 0);
	struct coroutine *C = S->co[id];
	assert((char *)&C > S->stack);
	_save_stack(C, S->stack + STACK_SIZE);
	C->status = COROUTINE_SUSPEND;
	S->running = -1;
	swapcontext(&C->ctx, &S->main);
}

/* 获得给定id的协程的状态 */
int coroutine_status(struct schedule *S, int id)
{
	assert(id >= 0 && id < S->cap);
	if (S->co[id] == NULL)
	{
		return COROUTINE_DEAD;
	}
	return S->co[id]->status;
}

/* 返回当前正在执行的协程id */
int coroutine_running(struct schedule *S)
{
	return S->running;
}
