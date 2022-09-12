import {forwardRef, useMemo, useState} from "react";
import {OverlayProps} from "../../types";
import {KEY} from "../../constants";

//TODO
export const Suggestions = forwardRef(({trigger, style, onSelect}: OverlayProps, ref) => {
    const [active, setActive] = useState(NaN)

    const filtered = useMemo(
        () => trigger.option.data.filter(s => s.toLowerCase().indexOf(trigger.value.toLowerCase()) > -1),
        [trigger.value]
    )

    const onClick = (e: any) => {
    }

    //TODO button hand
    const onKeyDown = (e: any) => {
        switch (e.key) {
            case KEY.ENTER:
                return;
            case KEY.UP:
                if (active === 0) {
                    return;
                }
                setActive(prevState => prevState--)
                break
            case KEY.DOWN:
                if (active - 1 === filtered.length) {
                    return;
                }
                setActive(prevState => prevState++)
                break
        }
    }

    if (!filtered.length) return null

    //TODO ref type
    return (
    // @ts-ignore
        <ul ref={ref} className="mk-suggestions" style={style}>
            {filtered.map((suggestion, index) => {
                let className;

                if (index === active) {
                    className = "mk-suggestion-active";
                }

                return (
                    <li key={suggestion}
                        className={className}
                        //onMouseOver={_ => setActive(index)}
                        onClick={_ => onSelect({label: suggestion, value: index.toString()})}
                        children={suggestion}
                    />
                );
            })}
        </ul>
    )
})