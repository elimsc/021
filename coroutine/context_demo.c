/* This example shows the usage of getcontext() and setcontext().    */

#include <stdio.h>
#include <ucontext.h>

void func(void);
int x = 0;

ucontext_t context;
ucontext_t *cp = &context;

int main(void)
{
    getcontext(cp);
    if (!x)
    {
        printf("getcontext has been called\n");
        func();
    }
    else
    {
        printf("setcontext has been called\n");
    }
}

void func(void)
{
    x++;
    setcontext(cp);
}