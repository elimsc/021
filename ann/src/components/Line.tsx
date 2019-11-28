import * as React from 'react';

interface Props {
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    weight: number,
}

interface State { }

export default class Line extends React.Component<Props, State> {
    render() {
        const { x1, y1, x2, y2, weight } = this.props;
        const width = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2) - 2;
        const deg = Math.atan((y2 - y1) / (x2 - x1)) / Math.PI * 180;
        // if (isNaN(weight) || weight == 0) {
        //     return null;
        // }
        return (
            <div
                style={{
                    width: width, border: '1px solid red', height: 0,
                    transform: `rotate(${deg}deg)`, transformOrigin: 'left',
                    position: "absolute", top: y1, left: x1
                }}>
                <span style={{ position: "absolute", left: '15%' }}>{weight}</span>
            </div>
        );
    }
}