import { jsx } from '@takt/ui/jsx-runtime'

export interface GroupProps {}

export function Group(props: GroupProps) {
    return jsx('group', { ...props })
}
