import { MarkedInput } from 'rc-marked-input'
import { useState } from 'react'

export function Step1Demo() {
  const [value, setValue] = useState('Hello @[World](meta)!')

  return (
    <div>
      <MarkedInput
        value={value}
        onChange={setValue}
        Mark={(props) => (
          <span
            style={{
              color: '#2196f3',
              fontWeight: 'bold',
            }}
          >
            @{props.value}
          </span>
        )}
        slotProps={{
          container: {
            className: 'marked-input-container',
          },
        }}
      />

      <div className="demo-output">
        <span className="demo-output-label">Plain text value:</span>
        <code className="demo-output-value">{value}</code>
      </div>
    </div>
  )
}
