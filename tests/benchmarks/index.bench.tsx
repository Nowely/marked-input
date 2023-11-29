import {bench, describe} from 'vitest'
import {getFileNamesOfData} from './_utils/getFileNames'
import {readFile} from "./_utils/readFile";
import path from "path";
import {Analyzers, AnnCountToMarkupMap, DataFolderPath, Joiners, LineCountToDiff, Parsers} from "./consts";
import {VirtualComponent} from "./_utils/VirtualComponent";



describe.skip('sort', async () => {
//get all data name
let names = (await getFileNamesOfData())
    .filter(value => value.includes('-k'))
    .sort((a, b) => {
        const a1 = Number(a.split('-')[0])
        const b1 = Number(b.split('-')[0])
        return a1 - b1
    })
for (const name of [names[0]]) {
    const data = await readFile(path.resolve(DataFolderPath, name))
    const clearName = name.replace('.txt', '')
    const [lineCount, annRatio, annCount] = clearName.split('-')
    const updateRule = LineCountToDiff[lineCount]
    const markups = AnnCountToMarkupMap[annCount]


    describe('render', () => {
        for (let i = 0; i < Analyzers.length - 1; i++) {
            for (let j = 1; j < Parsers.length - 1; j++) {
                for (let k = 0; k < Joiners.length; k++) {
                    const component = new VirtualComponent(markups, [i, j, k])

                    const inputData = data.substring(0, data.length - updateRule.count * updateRule.speed)
                    const updaterData = data.substring(data.length - updateRule.count * updateRule.speed)

                    bench(`${i}-${j}-${k} for ${name}`, () => {
                        component.render(inputData)
                    }, {time: 1000})
                }
            }
        }
    })

    describe('update', () => {
        for (let i = 0; i < Analyzers.length - 1; i++) {
            for (let j = 1; j < Parsers.length - 1; j++) {
                for (let k = 0; k < Joiners.length; k++) {
                    const component = new VirtualComponent(markups, [i, j, k])

                    const inputData = data.substring(0, data.length - updateRule.count * updateRule.speed)
                    const updaterData = data.substring(data.length - updateRule.count * updateRule.speed)

                    component.render(inputData)

                    let currentPosition = 0
                    for (let l = 0; l < updateRule.count; l++) {
                        let c = updaterData.substring(currentPosition, currentPosition + updateRule.speed)
                        currentPosition = currentPosition + updateRule.speed
                        bench(`${i}-${j}-${k}`, () => {
                            component.update(str => str + c)
                        }, {time: 1000})
                    }
                }
            }
        }
    })

}
})
