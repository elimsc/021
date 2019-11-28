// 任意值转number, 非number转0
function toNumber(v: any) {
    let n = Number(v);
    return isNaN(n) ? 0 : n;
}

class Unit {
    layer_index: number;
    unit_index: number;

    bias: number;
    inputs: number[];
    weights: number[];

    net: number;
    output: number;
    fn: string; // 激活函数
    sigma: number; // E对net的偏导

    get active(): boolean {
        return this.output && this.output != 0;
    }

    constructor(layer_index: number, unit_index: number, inputs: number[], weights: number[], bias: number, fn?: string) {
        this.layer_index = layer_index;
        this.unit_index = unit_index;

        this.inputs = inputs.map(v => toNumber(v)); // 必须保证全部为number, 不能有undefined之类的
        this.weights = weights.map(v => toNumber(v));
        this.bias = bias;

        this.fn = fn;
    }

    private get active_fn() {
        return getFnByName(this.fn);
    }

    private get d_fn() {
        return getDFnByName(this.fn);
    }

    static newEmptyUnit(): Unit {
        return new Unit(0, 0, [], [], 0);
    }


    private calcNet() {
        let r = 0;
        for (let i = 0; i < this.inputs.length; i++) {
            r += toNumber(this.inputs[i]) * toNumber(this.weights[i]);
        }
        this.net = r + this.bias;
    }

    private calcOutput() {
        this.output = this.active_fn(this.net);
    }

    private calcSigma(next_sigmas: number[], next_weights: number[]) {
        let pd_out_net = this.d_fn(this.output);
        let r = 0;
        for (let i = 0; i < next_sigmas.length; i++) {
            r += next_sigmas[i] * next_weights[i];
        }
        this.sigma = r * pd_out_net;
    }

    private _updateWeight(learning_rate: number): [number, number] {
        let new_weights = [];
        for (let i = 0; i < this.weights.length; i++) {
            const weight = this.weights[i];
            if (weight != 0) {
                new_weights.push(weight - this.sigma * learning_rate * this.inputs[i]);
            } else {
                new_weights.push(0);
            }
        }
        this.weights = new_weights;
        return [this.layer_index, this.unit_index];
    }

    // BackPropagation, 更新输入的weight
    *bp(next_sigmas: number[], next_weights: number[], learning_rate: number) {
        this.calcSigma(next_sigmas, next_weights);
        yield this._updateWeight(learning_rate);
    }

    private _compute(): [number, number] {
        this.calcNet();
        this.calcOutput();
        return [this.layer_index, this.unit_index];
    }

    // 计算output
    *compute() {
        // if (this.layer_index == 1) console.log(1);
        yield this._compute();
    }


}

class Layer {
    private _bias: number;
    private _fn: string;
    units: Unit[];
    layer_index: number;

    get fn() {
        return this._fn;
    }

    set fn(fn: string) {
        this._fn = fn;
        for (const unit of this.units) {
            unit.fn = fn;
        }
    }


    constructor(layer_index: number, unit_count: number, bias: number) {
        this.layer_index = layer_index;
        this._bias = bias;
        this.units = [];
        for (let i = 0; i < unit_count; i++) {
            this.units.push(new Unit(layer_index, i, [], [], bias));
        }
    }

    get bias(): number {
        return this._bias;
    }

    set bias(v: number) {
        this._bias = v;
        for (const unit of this.units) {
            unit.bias = v;
        }
    }

    static newEmptyLayer(): Layer {
        return new Layer(0, 0, 0);
    }

    static newInputLayer(inputs: number[]): Layer {
        const layer = new Layer(0, inputs.length, 0);
        for (let i = 0; i < inputs.length; i++) {
            layer.units[i].output = inputs[i];
        }
        return layer;
    }

    clearOutputs() {
        for (const unit of this.units) {
            unit.output = null;
        }
    }

    *compute() {
        for (const unit of this.units) {
            yield* unit.compute();
        }
    }

    *bp(next_sigmas: Array<number[]>, next_weights: Array<number[]>, learning_rate: number) {
        for (let i = 0; i < this.units.length; i++) {
            yield* this.units[i].bp(next_sigmas[i], next_weights[i], learning_rate);
        }
    }

}

class ANN {
    private _inputs: number[];
    private _biases: number[];
    layers: Layer[];
    expected_outputs: number[];
    learning_rate: number;
    private _fn: string;

    constructor(inputs: number[], expected_outs: number[], layer_count: number, units_count: number[], biases: number[]) {
        this.learning_rate = 1;
        this._inputs = inputs;
        this.expected_outputs = expected_outs;
        this.layers = [];
        this._biases = biases;
        // 输入层
        this.layers.push(Layer.newInputLayer(inputs));
        // 一般层
        for (let i = 0; i < layer_count; i++) {
            this.layers.push(new Layer(i + 1, units_count[i], biases[i]));
        }
        this.rand();
    }

    get biases(): number[] {
        return this._biases;
    }

    get fn() {
        return this._fn;
    }

    set fn(fn: string) {
        this._fn = fn;
        for (let i = 1; i < this.layers.length; i++) {
            this.layers[i].fn = fn;
        }
    }

    get inputs(): number[] {
        return this._inputs;
    }

    static newEmptyANN() {
        return new ANN([], [], 0, [], []);
    }

    // 随机初始化权值
    rand() {
        for (let i = 1; i < this.layers.length; i++) {
            const layer = this.layers[i];
            for (let j = 0; j < layer.units.length; j++) {
                const weights = Array(this.layers[i - 1].units.length).fill(0).map(() => Math.random());
                layer.units[j].weights = weights;
            }
        }
    }

    update(inputs: number[], exp_outs: number[], learning_rate: number, biases: number[]) {
        this.setInputs(inputs);
        this.expected_outputs = exp_outs;
        this.learning_rate = learning_rate;
        this._biases = biases;
    }

    clearOutputs() {
        for (let i = 1; i < this.layers.length; i++) {
            this.layers[i].clearOutputs();
        }
    }

    private setInputs(inputs: number[]) {
        this._inputs = inputs;
        this.layers[0] = Layer.newInputLayer(inputs);
    }

    // 计算误差
    get err(): number {
        let err = 0;
        const last_layer = this.layers[this.layers.length - 1];
        for (let i = 0; i < last_layer.units.length; i++) {
            err += (last_layer.units[i].output - this.expected_outputs[i]) ** 2;
        }
        return err / 2;
    }

    *compute() {
        let prev_outs = this.inputs;
        for (let i = 1; i < this.layers.length; i++) {
            const layer = this.layers[i];
            layer.units.map(unit => unit.inputs = prev_outs);
            yield* layer.compute();
            prev_outs = layer.units.map(unit => unit.output);
        }
    }

    private *bp() {
        const layer_count = this.layers.length;
        // 最后一层
        const last_layer = this.layers[layer_count - 1];
        let next_sigmas = [];
        let next_weights = [];
        for (let i = 0; i < last_layer.units.length; i++) {
            next_sigmas.push([this.expected_outputs[i] - last_layer.units[i].output]);
            next_weights.push([-1]);
        }
        yield* this.layers[layer_count - 1].bp(next_sigmas, next_weights, this.learning_rate);
        // 一般层
        for (let i = layer_count - 2; i > 0; i--) {
            next_sigmas = [];
            next_weights = [];
            let cur_layer = this.layers[i];
            let next_layer = this.layers[i + 1];

            for (let j = 0; j < cur_layer.units.length; j++) {
                next_sigmas[j] = [];
                next_weights[j] = [];
                for (let k = 0; k < next_layer.units.length; k++) {
                    next_sigmas[j].push(next_layer.units[k].sigma);
                    next_weights[j].push(next_layer.units[k].weights[j]);
                }
            }
            yield* cur_layer.bp(next_sigmas, next_weights, this.learning_rate);
        }
    }


    *train(): Generator {
        while (true) {
            yield* this.compute();
            yield* this.bp();
        }
    }

    stringfy() {
        return JSON.stringify(this);
    }

    static parse(s: string): ANN {
        let ann = ANN.newEmptyANN();
        let obj = JSON.parse(s);
        Object.assign(ann, obj);
        ann.layers = [];
        for (const layer of obj.layers) {
            let newLayer = Layer.newEmptyLayer();
            Object.assign(newLayer, layer);
            newLayer.units = [];
            for (let unit of layer.units) {
                let newUnit = Unit.newEmptyUnit();
                Object.assign(newUnit, unit);
                if (newUnit.layer_index != 0) {
                    newUnit.output = null;
                }
                newLayer.units.push(newUnit);
            }
            ann.layers.push(newLayer);
        }
        return ann;
    }
}

export { ANN, Layer, Unit };

function getFnByName(name: string) {
    switch (name) {
        case 'sigmoid':
            return n => 1 / (1 + Math.exp(-n));
        case 'tanh':
            return n => (Math.exp(n) - Math.exp(-n)) / (Math.exp(n) + Math.exp(-n));
        default:
            return n => n;
    }
}

function getDFnByName(name: string) {
    switch (name) {
        case 'sigmoid':
            return n => n * (1 - n);
        case 'tanh':
            return n => 1 - n * n;
        default:
            return n => 1;
    }
}


// const ann = new ANN([0.05, 0.1], [0.01, 0.99, 0.8], 3, [2, 5, 3], [0.35, 0.6, 0.7]);
// const gen = ann.train();
// for (let i = 0; i < 1000000; i++) {
//     if (i == 100) {
//         console.log(ann.err);
//     }
//     gen.next();
// }
// console.log(ann.err);
