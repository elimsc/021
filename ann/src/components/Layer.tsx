import * as React from 'react';
import Unit from './Unit';
import { Layer as LayerModel } from '../model/ann';

interface Props {
    unitWidth: number, // 神经元的半径
    containerStyle?: object,
    unitContainerStyle?: object,
    onDoubleClick: Function,
    handleUnitDoubleClick: Function,

    layer: LayerModel;
}
interface State { }

export default class Layer extends React.Component<Props, State> {
    render() {
        const { containerStyle, unitWidth, unitContainerStyle, onDoubleClick, handleUnitDoubleClick, layer } = this.props;
        const count = layer.units.length;
        let border = 'none';
        return (
            <div
                onDoubleClick={() => onDoubleClick(layer)}
                style={{ border: border, display: 'inline-block', position: 'absolute', top: 0, ...containerStyle }}>
                <p style={{ marginTop: -20, textAlign: "center" }}>{`Layer#${layer.layer_index}`}</p>
                {Array(count).fill(0).map((v, i) => {
                    return <Unit key={i}
                        unit={layer.units[i]}
                        onDoubleClick={handleUnitDoubleClick}
                        width={unitWidth}
                        containerStyle={{ marginTop: unitWidth / 2, marginBottom: unitWidth / 2, ...unitContainerStyle }} />
                })}
            </div>
        );
    }
}