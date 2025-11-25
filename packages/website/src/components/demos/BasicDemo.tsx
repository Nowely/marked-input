import { MarkedInput } from 'rc-marked-input'
import { useState } from 'react'

export function BasicDemo() {
  const [value, setValue] = useState('Type @ to mention someone!')

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
              backgroundColor: '#e3f2fd',
              padding: '2px 6px',
              borderRadius: '4px',
            }}
          >
            @{props.value}
          </span>
        )}
        options={[
          {
            markup: '@[__value__](__meta__)',
            slotProps: {
              overlay: {
                trigger: '@',
                data: ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve'],
              },
            },
          },
        ]}
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
