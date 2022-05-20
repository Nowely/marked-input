export interface PlainTextProps {
    value: string
}

export const PlainText = ({value}: PlainTextProps) => (
    <>
        <br/>
        <b> Plaint text: </b>
        <p> {value} </p>
    </>
)