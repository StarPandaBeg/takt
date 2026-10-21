import { resolve, type JSXNode } from '@takt/ui'
import { Text } from '@takt/ui/components'

function Tree(): JSXNode {
    return (
        <>
            <Text>123</Text>
            <Text>456</Text>
        </>
    )
}

const treeNode = Tree()
const tree = resolve(treeNode)
console.log(JSON.stringify(tree, undefined, 4))
