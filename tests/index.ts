import {Markups_2} from './_utils/consts'
import {VirtualComponent} from './_utils/VirtualComponent'

//const tester = new Benchmark()
//await tester.loadResult()
//await tester.start()
//await tester.saveResult()

const component = new VirtualComponent(Markups_2, [0, 0, 1])

//First render
component.render('Hello @[friend]')


component.update(str => str + '1')

console.log(component.value)
console.log(component.tokens)

component.update(str => str + ' @[friend2]')
console.log(component.value)
console.log(component.tokens)

//console.log(a)


