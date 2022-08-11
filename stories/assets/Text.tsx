import "./Text.css"

export interface TextProps {
    value: string
    label?: string
}

export const Text = ({value, label}: TextProps) => (
    <>
        <br/>
        {label && <b>{label}</b>}
        <pre>{value}</pre>
    </>
)