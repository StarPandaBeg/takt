import { defineImageAsset } from '@takt/ui/components'

const moduleUrl = (import.meta as ImportMeta & { readonly url: string }).url

export default defineImageAsset('../../assets/leaves.jpg', moduleUrl)
