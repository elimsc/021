import * as React from 'react';
import { Button, Input, Form, Divider, Modal, Upload, message, InputNumber, Slider, Row, Col, Select } from 'antd';
import { FormComponentProps } from 'antd/es/form';

import LayerView from './components/Layer';
import LineView from './components/Line';
import { ANN, Unit, Layer } from './model/ann2';

message.config({
    top: 30,
    duration: 1,
    maxCount: 3,
});

interface Props extends FormComponentProps { }
interface State {
    ann: ANN, // 神经元的底层model
    unitWidth: number, // 神经元宽度
    layerSpan: number, // 层之间的距离

    // 控制计算
    gen: Generator,
    stop: boolean,
    pauseTime: number,

    selectedUnit: Unit,
    selectedLayer: Layer,

    // modal相关
    annModal: boolean,
    updateAnnModal: boolean,
    setLayerModal: boolean,
    editUnitModal: boolean,
    editLayerModal: boolean,

    showErr: boolean,
}

const formItemLayout = {
    labelCol: { span: 6 },
    wrapperCol: { span: 16 },
};
const formTailLayout = {
    labelCol: { span: 6 },
    wrapperCol: { span: 18, offset: 6 },
};

const fns = ['sigmoid', 'tanh'];

class Home extends React.Component<Props, State> {

    constructor(props) {
        super(props);


        // let ann = new ANN([0.05, 0.1], [0.01, 0.99], 5, [2, 5, 3, 2, 2], [0.35, 0.6, 0.7, 0.2, 0.2]);
        this.state = {
            ann: null,
            unitWidth: 60,
            layerSpan: 100,

            selectedUnit: null,
            selectedLayer: null,

            annModal: false,
            updateAnnModal: false,
            setLayerModal: false,
            editUnitModal: false,
            editLayerModal: false,

            gen: null,
            stop: false,
            pauseTime: 0,
            showErr: false,
        };
    }

    closeModal = () => {
        this.setState({
            setLayerModal: false,
            editUnitModal: false,
            annModal: false,
            updateAnnModal: false,
            editLayerModal: false,
        });
        this.setState({
            selectedUnit: null,
        });
        this.props.form.resetFields();
    }

    // 编辑神经网络
    updateAnn = e => {
        e.preventDefault();
        const { ann } = this.state;
        this.props.form.validateFieldsAndScroll(['update_ann_inputs', 'update_ann_exp_outs', 'update_ann_learning_rate', 'update_ann_biases', 'fn'], (err, values) => {
            if (!err) {
                const inputs = stringToArray(values['update_ann_inputs']);
                const exp_outs = stringToArray(values['update_ann_exp_outs']);
                const biases = stringToArray(values['update_ann_biases']);
                const lr = Number(values['update_ann_learning_rate']);
                ann.update(inputs, exp_outs, lr, biases);
                ann.fn = values['fn'];
                this.closeModal();
            }
        });
    }

    // 新增用于训练的神经网络
    addAnn = e => {
        e.preventDefault();
        this.props.form.validateFieldsAndScroll(['ann_inputs', 'ann_exp_outs', 'ann_layer_count',
            'ann_units_count', 'ann_biases', 'fn', 'ann_learning_rate'], (err, values) => {
                if (!err) {
                    const ann_inputs = stringToArray(values['ann_inputs']);
                    const ann_exp_outs = stringToArray(values['ann_exp_outs']);
                    const ann_layer_count = Number(values['ann_layer_count']);
                    const ann_units_count = stringToArray(values['ann_units_count']);
                    const ann_biases = stringToArray(values['ann_biases']);
                    const ann = new ANN(ann_inputs, ann_exp_outs, ann_layer_count, ann_units_count, ann_biases);
                    ann.learning_rate = Number(values['ann_learning_rate']);
                    ann.fn = values['fn'];
                    this.setState({ ann, gen: ann.train() });
                    this.closeModal();
                }
            });
    }

    // 双击神经元，用于编辑
    handleUnitDoubleClick = (unit: Unit) => {
        this.setState({ selectedUnit: unit, editUnitModal: true });
    }

    // 双击层，用户编辑
    handleLayerDoubleClick = (layer: Layer) => {
        this.setState({ selectedLayer: layer, editLayerModal: true });
    }

    // 更新神经元
    updateUnit = e => {
        e.preventDefault();
        const { selectedUnit } = this.state;
        this.props.form.validateFieldsAndScroll(["unit_bias", "unit_weights", "fn"], (err, values) => {
            if (!err) {
                const bias = Number(values['unit_bias']);
                const weights = stringToArray(values['unit_weights']);
                selectedUnit.bias = bias;
                selectedUnit.weights = weights;
                selectedUnit.fn = values['fn'];
                this.closeModal();
            }
        });
    }

    // 设置层
    setLayer = e => {
        e.preventDefault();
        const { ann } = this.state;
        this.props.form.validateFieldsAndScroll(["layer_index", "layer_unit_count", "layer_bias", "fn"], (err, values) => {
            if (!err) {
                const layerIndex = Number(values['layer_index']);
                const unitCount = Number(values['layer_unit_count']);
                const bias = Number(values['layer_bias']);
                ann.layers[layerIndex] = new Layer(layerIndex, unitCount, bias);
                ann.layers[layerIndex].fn = values['fn'];
                this.closeModal();
            }
        });
    }

    updateLayer = e => {
        e.preventDefault();
        const { selectedLayer } = this.state;
        this.props.form.validateFieldsAndScroll(["edit_layer_bias", "edit_layer_fn"], (err, values) => {
            if (!err) {
                const bias = Number(values['edit_layer_bias']);
                selectedLayer.bias = bias;
                selectedLayer.fn = values['edit_layer_fn'];
                this.closeModal();
            }
        });
    }

    handleReadFile = (file) => {
        let reader = new FileReader();
        reader.onload = e => {
            const result = e.target.result;
            const ann = ANN.parse(result.toString());
            this.setState({ ann, gen: ann.train() });
            message.success("导入成功");
        }
        reader.readAsText(file);
    }

    handleExportFile = () => {
        const { ann } = this.state;
        saveFile(ann.stringfy(), "1.json");
    }


    // 单步执行
    handleSingleStep = () => {
        const { gen } = this.state;
        let r = gen.next();
        this.forceUpdate();
        if (r.done) {
            message.success("执行完成");
        }
    }

    handleTrain = async () => {
        const { gen, pauseTime } = this.state;
        this.setState({ showErr: true });
        let r = gen.next();
        while (r.done == false && !this.state.stop) {
            this.forceUpdate();
            await sleep(pauseTime);
            r = gen.next();
        }
        if (this.state.stop) {
            message.info("暂停成功");
            this.setState({ stop: false });
        }
        this.setState({ showErr: false });
    }

    handleStop = () => {
        this.setState({ stop: true });
    }


    handleCompute = async () => {
        this.setState({ stop: false });
        const { ann, pauseTime } = this.state;
        const gen = ann.compute()
        let r = gen.next();
        while (r.done == false && !this.state.stop) {
            this.forceUpdate();
            await sleep(pauseTime);
            r = gen.next();
        }
        if (this.state.stop) {
            message.info("暂停成功");
            this.setState({ stop: false });
        } else {
            message.success("执行完成");
        }
    }

    render() {
        const { ann, unitWidth, layerSpan } = this.state;
        const { setLayerModal, editUnitModal } = this.state;
        const { selectedUnit, selectedLayer } = this.state;
        const { getFieldDecorator } = this.props.form;

        return (
            <div>
                <div>
                    {/* 编辑神经元modal */}
                    <Modal visible={editUnitModal} onCancel={() => this.closeModal()} footer={null}>
                        <Form {...formItemLayout} onSubmit={this.updateUnit}>
                            <Form.Item label="加权和(只读)">
                                <Input value={selectedUnit ? selectedUnit.net : ""} />

                            </Form.Item>
                            <Form.Item label="输出(只读)">
                                <Input value={selectedUnit ? selectedUnit.output : ""} />
                            </Form.Item>
                            <Form.Item label="输入(只读)">
                                <Input value={selectedUnit ? selectedUnit.inputs.toString() : ""} />
                            </Form.Item>
                            <Form.Item label="输入的权值">
                                {getFieldDecorator('unit_weights', {
                                    initialValue: selectedUnit ? selectedUnit.weights : "",
                                    rules: [{ required: true, message: '不能为空' }],
                                })(<Input />)}
                            </Form.Item>
                            <Form.Item label="bias">
                                {getFieldDecorator('unit_bias', {
                                    initialValue: selectedUnit ? selectedUnit.bias : "",
                                    rules: [{ required: true, message: '不能为空' }],
                                })(<Input />)}
                            </Form.Item>
                            <Form.Item label="激活函数">
                                {getFieldDecorator('fn', {
                                    initialValue: selectedUnit ? selectedUnit.fn : "",
                                    rules: [
                                        {
                                            required: true,
                                            message: '不能为空',
                                        },
                                    ],
                                })(<Select>
                                    {fns.map((v, i) => (
                                        <Select.Option key={i} value={v}>{v}</Select.Option>
                                    ))}
                                </Select>)}
                            </Form.Item>

                            <Form.Item {...formTailLayout}>
                                <Button type="primary" htmlType="submit" >确定</Button>
                            </Form.Item>
                        </Form>
                    </Modal>
                    {/* 设置层modal */}
                    <Modal visible={setLayerModal} onCancel={() => this.closeModal()} footer={null}>
                        <Form {...formItemLayout} onSubmit={this.setLayer}>
                            <Form.Item label="层index">
                                {getFieldDecorator('layer_index', {
                                    rules: [{ required: true, message: '不能为空' }],
                                })(<Input type="number" />)}
                            </Form.Item>
                            <Form.Item label="神经元个数">
                                {getFieldDecorator('layer_unit_count', {
                                    rules: [{ required: true, message: '不能为空' }],
                                })(<Input type="number" />)}
                            </Form.Item>
                            <Form.Item label="bias">
                                {getFieldDecorator('layer_bias', {
                                    rules: [{ required: true, message: '不能为空' }],
                                })(<Input />)}
                            </Form.Item>
                            <Form.Item label="激活函数">
                                {getFieldDecorator('fn', {
                                    rules: [
                                        {
                                            required: true,
                                            message: '不能为空',
                                        },
                                    ],
                                })(<Select>
                                    {fns.map((v, i) => (
                                        <Select.Option key={i} value={v}>{v}</Select.Option>
                                    ))}
                                </Select>)}
                            </Form.Item>


                            <Form.Item {...formTailLayout}>
                                <Button type="primary" htmlType="submit" >确定</Button>
                            </Form.Item>
                        </Form>
                    </Modal>

                    {/* 编辑/查看层modal */}
                    <Modal visible={this.state.editLayerModal} onCancel={() => this.closeModal()} footer={null}>
                        <Form {...formItemLayout} onSubmit={this.updateLayer}>
                            <Form.Item label="层index">
                                <Input value={selectedLayer ? selectedLayer.layer_index : ""} />
                            </Form.Item>
                            <Form.Item label="神经元个数">
                                <Input value={selectedLayer ? selectedLayer.units.length : ""} />
                            </Form.Item>
                            <Form.Item label="bias">
                                {getFieldDecorator('edit_layer_bias', {
                                    initialValue: selectedLayer ? selectedLayer.bias : "",
                                    rules: [{ required: true, message: '不能为空' }],
                                })(<Input />)}
                            </Form.Item>
                            <Form.Item label="激活函数">
                                {getFieldDecorator('edit_layer_fn', {
                                    initialValue: selectedLayer ? selectedLayer.fn : "",
                                    rules: [
                                        {
                                            required: true,
                                            message: '不能为空',
                                        },
                                    ],
                                })(<Select>
                                    {fns.map((v, i) => (
                                        <Select.Option key={i} value={v}>{v}</Select.Option>
                                    ))}
                                </Select>)}
                            </Form.Item>


                            <Form.Item {...formTailLayout}>
                                <Button type="primary" htmlType="submit" >确定</Button>
                            </Form.Item>
                        </Form>
                    </Modal>

                    {/* 新增神经网络modal */}
                    <Modal visible={this.state.annModal} onCancel={() => this.closeModal()} footer={null}>
                        <Form {...formItemLayout} onSubmit={this.addAnn}>

                            <Form.Item label="输入">
                                {getFieldDecorator('ann_inputs', {
                                    rules: [{ required: true, message: '不能为空', }],
                                })(<Input />)}
                            </Form.Item>

                            <Form.Item label="期望输出">
                                {getFieldDecorator('ann_exp_outs', {
                                    rules: [{ required: true, message: '不能为空', }],
                                })(<Input />)}
                            </Form.Item>

                            <Form.Item label="层数">
                                {getFieldDecorator('ann_layer_count', {
                                    rules: [{ required: true, message: '不能为空', }],
                                })(<Input type="number" />)}
                            </Form.Item>

                            <Form.Item label="每层神经元个数">
                                {getFieldDecorator('ann_units_count', {
                                    rules: [{ required: true, message: '不能为空', }],
                                })(<Input />)}
                            </Form.Item>

                            <Form.Item label="bias">
                                {getFieldDecorator('ann_biases', {
                                    rules: [{ required: true, message: '不能为空', }],
                                })(<Input />)}
                            </Form.Item>
                            <Form.Item label="学习速度">
                                {getFieldDecorator('ann_learning_rate', {
                                    rules: [{ required: true, message: '不能为空', }],
                                })(<Input />)}
                            </Form.Item>

                            <Form.Item label="激活函数">
                                {getFieldDecorator('fn', {
                                    rules: [
                                        {
                                            required: true,
                                            message: '不能为空',
                                        },
                                    ],
                                })(<Select>
                                    {fns.map((v, i) => (
                                        <Select.Option key={i} value={v}>{v}</Select.Option>
                                    ))}
                                </Select>)}
                            </Form.Item>

                            <Form.Item {...formTailLayout}>
                                <Button type="primary" htmlType="submit" >确定</Button>
                            </Form.Item>
                        </Form>
                    </Modal>
                    {/* 编辑神经网络modal */}
                    <Modal visible={this.state.updateAnnModal} onCancel={() => this.closeModal()} footer={null}>
                        <Form {...formItemLayout} onSubmit={this.updateAnn}>
                            <Form.Item label="误差(只读)">
                                <Input value={ann && ann.err ? ann.err : ""} />
                            </Form.Item>
                            <Form.Item label="输入">
                                {getFieldDecorator('update_ann_inputs', {
                                    initialValue: ann ? ann.inputs : "",
                                    rules: [
                                        {
                                            required: true,
                                            message: '不能为空',
                                        },
                                    ],
                                })(<Input />)}
                            </Form.Item>
                            <Form.Item label="期望输出">
                                {getFieldDecorator('update_ann_exp_outs', {
                                    initialValue: ann ? ann.expected_outputs : "",
                                    rules: [
                                        {
                                            required: true,
                                            message: '不能为空',
                                        },
                                    ],
                                })(<Input />)}
                            </Form.Item>
                            <Form.Item label="bias">
                                {getFieldDecorator('update_ann_biases', {
                                    initialValue: ann ? ann.expected_outputs : "",
                                    rules: [
                                        {
                                            required: true,
                                            message: '不能为空',
                                        },
                                    ],
                                })(<Input />)}
                            </Form.Item>
                            <Form.Item label="学习速度">
                                {getFieldDecorator('update_ann_learning_rate', {
                                    initialValue: ann ? ann.learning_rate : "",
                                    rules: [
                                        {
                                            required: true,
                                            message: '不能为空',
                                        },
                                    ],
                                })(<Input />)}
                            </Form.Item>
                            <Form.Item label="激活函数">
                                {getFieldDecorator('fn', {
                                    initialValue: ann ? ann.fn : "",
                                    rules: [
                                        {
                                            required: true,
                                            message: '不能为空',
                                        },
                                    ],
                                })(<Select>
                                    {fns.map((v, i) => (
                                        <Select.Option key={i} value={v}>{v}</Select.Option>
                                    ))}
                                </Select>)}
                            </Form.Item>

                            <Form.Item {...formTailLayout}>
                                <Button type="primary" htmlType="submit" >确定</Button>
                            </Form.Item>
                        </Form>
                    </Modal>

                    <Button onClick={() => this.setState({ annModal: true })}>新增神经网络</Button>
                    <Button onClick={() => this.setState({ updateAnnModal: true })}>编辑/查看神经网络</Button>
                    <Button onClick={() => this.setState({ setLayerModal: true })}>设置层</Button>
                    <Button onClick={() => {
                        ann.rand();
                        this.forceUpdate();
                    }}>随机生成参数</Button>

                    <Button style={{ marginLeft: 20 }} onClick={() => this.handleTrain()}>训练</Button>
                    <Button onClick={() => this.handleCompute()}>计算</Button>
                    <Button onClick={() => this.handleStop()}>暂停</Button>
                    <Button onClick={() => this.handleSingleStep()}>单步执行</Button>
                    <Button onClick={() => {
                        ann.clearOutputs();
                        this.forceUpdate();
                    }}>清空输出</Button>

                    <Button style={{ marginLeft: 20 }} onClick={() => this.handleExportFile()}>导出</Button>
                    <Upload showUploadList={false} beforeUpload={() => false} onChange={(info) => this.handleReadFile(info.file)}>
                        <Button> 导入 </Button>
                    </Upload>

                    <Row style={{ marginTop: 10 }}>
                        <Col span={8}>
                            <Row >
                                <Col span={4}><Button type="link" disabled>神经元大小:</Button></Col>
                                <Col span={6}>
                                    <InputNumber
                                        min={20} max={100} style={{ marginLeft: 16 }} value={this.state.unitWidth}
                                        onChange={v => this.setState({ unitWidth: Number(v.toString()) })}
                                    />
                                </Col>
                                <Col span={12}>
                                    <Slider
                                        min={20} max={100} value={this.state.unitWidth}
                                        onChange={v => this.setState({ unitWidth: Number(v.toString()) })}
                                    />
                                </Col>
                            </Row>
                        </Col>
                        <Col span={8}>
                            <Row>
                                <Col span={4}><Button type="link" disabled>层间距:</Button></Col>
                                <Col span={6}>
                                    <InputNumber
                                        min={30} max={250} style={{ marginLeft: 16 }} value={this.state.layerSpan}
                                        onChange={v => this.setState({ layerSpan: Number(v.toString()) })}
                                    />
                                </Col>
                                <Col span={12}>
                                    <Slider
                                        min={30} max={250} value={this.state.layerSpan}
                                        onChange={v => this.setState({ layerSpan: Number(v.toString()) })}
                                    />
                                </Col>
                            </Row>
                        </Col>
                        <Col span={8}>
                            <Row>
                                <Col span={4}><Button type="link" disabled>计算延迟:</Button></Col>
                                <Col span={6}>
                                    <InputNumber
                                        min={0} max={1500} style={{ marginLeft: 16 }} value={this.state.pauseTime}
                                        onChange={v => this.setState({ pauseTime: Number(v.toString()) })}
                                    />
                                </Col>
                                <Col span={12}>
                                    <Slider
                                        min={0} max={1500} value={this.state.pauseTime}
                                        onChange={v => this.setState({ pauseTime: Number(v.toString()) })}
                                    />
                                </Col>
                            </Row>
                        </Col>
                    </Row>



                    <p style={{ textAlign: "center" }}>{ann && this.state.showErr ? `误差: ${ann.err}` : ""}</p>



                </div>
                <Divider />
                {ann ?
                    <div style={{ position: 'relative' }}>
                        {ann.layers.map((layer, i) => (
                            <LayerView
                                layer={layer}
                                handleUnitDoubleClick={this.handleUnitDoubleClick}
                                onDoubleClick={this.handleLayerDoubleClick}
                                key={i}
                                unitWidth={unitWidth}
                                containerStyle={{ left: (unitWidth + layerSpan) * i }} />
                        ))}
                        {ann.layers.map(layer => {
                            const layerIndex1 = layer.layer_index - 1;
                            const layerIndex2 = layer.layer_index;
                            const x1 = layerIndex1 * (unitWidth + layerSpan) + unitWidth / 2;
                            const x2 = layerIndex2 * (unitWidth + layerSpan) + unitWidth / 2;
                            return layer.units.map(unit => {
                                const unitIndex2 = unit.unit_index;
                                return unit.weights.map((weight, i) => {
                                    const unitIndex1 = i;
                                    const y1 = unitIndex1 * 3 / 2 * unitWidth + unitWidth;
                                    const y2 = unitIndex2 * 3 / 2 * unitWidth + unitWidth;
                                    return <LineView
                                        key={i} x1={x1} y1={y1} x2={x2} y2={y2} weight={weight} />
                                })
                            })
                        })}
                    </div>
                    : null}
            </div >
        );
    }
}

export default Form.create<Props>()(Home);

function saveFile(data: string, filename: string) {
    var elementA = document.createElement('a');
    elementA.setAttribute('href', 'data:text/plain;charset=utf-8,' + data);
    elementA.setAttribute('download', filename);
    elementA.style.display = 'none';
    document.body.appendChild(elementA);
    elementA.click();
    document.body.removeChild(elementA);
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function stringToArray(s: object): number[] {
    if (Array.isArray(s)) return s;
    return s.toString().split(',').map(v => Number(v));
}
