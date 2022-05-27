import "./PlainText.css"

export interface PlainTextProps {
    value: string
}

export const PlainText = ({value}: PlainTextProps) => (
    <>
        <br/>
        <b> Plaint text: </b>
        <pre> {value} </pre>
    </>
)