import * as React from 'react';
import { Unit as UnitModel } from '../model/ann';

interface Props {
    width: number,
    containerStyle?: object,
    onDoubleClick: Function,

    unit: UnitModel,
}
interface State { }

export default class Unit extends React.Component<Props, State> {
    render() {
        const { unit, width, containerStyle, onDoubleClick } = this.props;

        let activeStyle: object = { "background": "#FF0033", width, height: width, border: 'none' };
        if (!unit.active) {
            activeStyle = { "background": "none" };
        }

        return (
            <div
                style={{
                    width: `${width - 2}px`,
                    height: `${width - 2}px`,
                    borderRadius: '50%',
                    border: '1px black solid',
                    ...containerStyle,
                    ...activeStyle,
                }}
                onDoubleClick={e => {
                    onDoubleClick(unit);
                    e.stopPropagation();
                }}
            >
                <span style={{ position: 'absolute', left: '20%', fontSize: '0.7rem' }}>{unit.output}</span>
            </div >
        );
    }
}
