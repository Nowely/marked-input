import "./Text.css"

export interface TextProps {
    value: string
    label?: string
}

export const Text = ({value, label = "Plaint text:"}: TextProps) => (
    <>
        <br/>
        <b>{label}</b>
        <pre>{value}</pre>
    </>
)