import { Column, Image } from '@takt/ui/components'
import panda from '../assets/panda.js'

import leaves from '../assets/leaves.js'
import { defineScene } from '../scene.js'

export const calendarSplashScreen = defineScene(() => {
    return (
        <>
            <Image
                src={leaves}
                width={800}
                height={480}
                fit="cover"
                dithering="ordered"
                threshold={128}
                smoothing
            />
            <Column
                x={0}
                y={0}
                width={800}
                height={480}
                justify="center"
                align="center"
            >
                <Image
                    src={panda}
                    width={380}
                    height={380}
                    fit="contain"
                    dithering="ordered"
                    smoothing
                    threshold={128}
                    invert
                />
            </Column>
        </>
    )
})
