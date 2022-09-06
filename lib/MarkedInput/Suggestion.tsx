import {useMemo, useState} from "react";
import {OverlayProps} from "./types";
import {KEY} from "./constants";

export interface SuggestionProps extends OverlayProps {
}

export const Suggestion = ({data, word, style, onSelect, ...props}: SuggestionProps) => {
    const [active, setActive] = useState(NaN)

    const filtered = useMemo(
        () => data.filter(s => s.toLowerCase().indexOf(word.toLowerCase()) > -1),
        [word]
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

    return (
        <ul className="mk-suggestions" style={style}>
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
}