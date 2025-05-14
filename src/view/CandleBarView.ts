/* eslint-disable @typescript-eslint/space-before-function-paren */
/**
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at

 * http://www.apache.org/licenses/LICENSE-2.0

 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import type Nullable from '../common/Nullable'
import type VisibleData from '../common/VisibleData'
import type BarSpace from '../common/BarSpace'
import { type EventHandler } from '../common/SyntheticEvent'
import { ActionType } from '../common/Action'
import { CandleType, type CandleBarColor, type RectStyle, PolygonType, type IndicatorPolygonStyle } from '../common/Styles'

import type ChartStore from '../store/ChartStore'

import { type FigureCreate } from '../component/Figure'
import { type RectAttrs } from '../extension/figure/rect'

import ChildrenView from './ChildrenView'

import { PaneIdConstants } from '../pane/types'
import { isValid } from '../common/utils/typeChecks'

export interface CandleBarOptions {
  type: Exclude<CandleType, CandleType.Area>
  styles: CandleBarColor
}

export default class CandleBarView extends ChildrenView {
  private readonly _boundCandleBarClickEvent = (data: VisibleData) => () => {
    this.getWidget().getPane().getChart().getChartStore().getActionStore().execute(ActionType.OnCandleBarClick, data)
    return false
  }

  override drawImp(ctx: CanvasRenderingContext2D): void {
    const pane = this.getWidget().getPane()
    const yAxis = pane.getAxisComponent()
    const isMain = pane.getId() === PaneIdConstants.CANDLE
    const chartStore = pane.getChart().getChartStore()

    const visibleDataList = chartStore.getVisibleDataList()
    const yAxisHeight =
      yAxis.getParent().getYAxisWidget()?.getBounding().height ?? 0
    const maxVolume = visibleDataList.reduce((accumulator, currentValue) => {
      return Math.max(
        currentValue.data?.volume ?? Number.MIN_VALUE,
        accumulator
      )
    }, Number.MIN_VALUE)

    const candleBarOptions = this.getCandleBarOptions(chartStore)
    const indicatorBarStyles = this.getIndicatorBarStyles(chartStore)

    if (candleBarOptions !== null) {
      // const yAxis = pane.getAxisComponent()
      this.eachChildren((data: VisibleData, barSpace: BarSpace) => {
        const { data: kLineData, x } = data
        if (isValid(kLineData)) {
          const { open, high, low, close, volume } = kLineData
          let color = (kLineData as any).color
          if (!(typeof color === 'string' && color.length > 0)) {
            color = null
          }
          const { type, styles } = candleBarOptions
          const colors: string[] = []
          const volumeColors: string[] = []
          if (close > open) {
            colors[0] = color ?? styles.upColor
            colors[1] = color ?? styles.upBorderColor
            colors[2] = color ?? styles.upWickColor

            volumeColors[0] =
              color ?? (indicatorBarStyles !== null
                ? indicatorBarStyles.upColor
                : colors[0])
          } else if (close < open) {
            colors[0] = color ?? styles.downColor
            colors[1] = color ?? styles.downBorderColor
            colors[2] = color ?? styles.downWickColor

            volumeColors[0] = color ??
              (indicatorBarStyles !== null
                ? indicatorBarStyles.downColor
                : colors[0])
          } else {
            colors[0] = color ?? styles.noChangeColor
            colors[1] = color ?? styles.noChangeBorderColor
            colors[2] = color ?? styles.noChangeWickColor

            volumeColors[0] =
              (color ?? (indicatorBarStyles !== null
                ? indicatorBarStyles.noChangeColor
                : colors[0]))
          }
          const openY = yAxis.convertToPixel(open)
          const closeY = yAxis.convertToPixel(close)
          const priceY = [
            openY, closeY,
            yAxis.convertToPixel(high),
            yAxis.convertToPixel(low)
          ]
          priceY.sort((a, b) => a - b)

          let rects: Array<FigureCreate<RectAttrs | RectAttrs[], Partial<RectStyle>>> = []
          switch (type) {
            case CandleType.CandleSolid: {
              rects = this._createSolidBar(x, priceY, barSpace, colors)
              break
            }
            case CandleType.CandleStroke: {
              rects = this._createStrokeBar(x, priceY, barSpace, colors)
              break
            }
            case CandleType.CandleUpStroke: {
              if (close > open) {
                rects = this._createStrokeBar(x, priceY, barSpace, colors)
              } else {
                rects = this._createSolidBar(x, priceY, barSpace, colors)
              }
              break
            }
            case CandleType.CandleDownStroke: {
              if (open > close) {
                rects = this._createStrokeBar(x, priceY, barSpace, colors)
              } else {
                rects = this._createSolidBar(x, priceY, barSpace, colors)
              }
              break
            }
            case CandleType.Ohlc: {
              const size = Math.min(Math.max(Math.round(barSpace.gapBar * 0.2), 1), 7)
              rects = [
                {
                  name: 'rect',
                  attrs: [
                    {
                      x: x - size / 2,
                      y: priceY[0],
                      width: size,
                      height: priceY[3] - priceY[0]
                    },
                    {
                      x: x - barSpace.halfGapBar,
                      y: openY + size > priceY[3] ? priceY[3] - size : openY,
                      width: barSpace.halfGapBar - size / 2,
                      height: size
                    },
                    {
                      x: x + size / 2,
                      y: closeY + size > priceY[3] ? priceY[3] - size : closeY,
                      width: barSpace.halfGapBar - size / 2,
                      height: size
                    }
                  ],
                  styles: { color: colors[0] }
                }
              ]
              break
            }
          }

          // 在底部显示交易量指标
          if (isMain && volume !== undefined && volume !== null) {
            const height = (yAxisHeight / 6) * (volume / maxVolume)
            rects.push({
              name: 'rect',
              attrs: {
                x: x - barSpace.halfGapBar + 0.5,
                y: yAxisHeight - height,
                width: barSpace.gapBar,
                height
              },
              styles: {
                style: PolygonType.Fill,
                color: volumeColors[0],
                borderSize: 1,
                borderColor: volumeColors[0]
              }
            })
          }

          rects.forEach(rect => {
            let handler: EventHandler | undefined
            if (isMain) {
              handler = {
                mouseClickEvent: this._boundCandleBarClickEvent(data)
              }
            }
            this.createFigure(rect, handler)?.draw(ctx)
          })
        }
      })
    }
  }

  protected getCandleBarOptions(chartStore: ChartStore): Nullable<CandleBarOptions> {
    const candleStyles = chartStore.getStyles().candle
    return {
      type: candleStyles.type as Exclude<CandleType, CandleType.Area>,
      styles: candleStyles.bar
    }
  }

  /**
   * 获取 Bar 类型指标的样式
   * @author hungtcs
   */
  protected getIndicatorBarStyles(chartStore: ChartStore): Nullable<IndicatorPolygonStyle> {
    const barStyles = chartStore.getStyles().indicator.bars[0]
    if (barStyles !== null && barStyles !== undefined) {
      return barStyles
    }
    return null
  }

  private _createSolidBar(x: number, priceY: number[], barSpace: BarSpace, colors: string[]): Array<FigureCreate<RectAttrs | RectAttrs[], Partial<RectStyle>>> {
    return [
      {
        name: 'rect',
        attrs: {
          x: x - 0.5,
          y: priceY[0],
          width: 1,
          height: priceY[3] - priceY[0]
        },
        styles: { color: colors[2] }
      },
      {
        name: 'rect',
        attrs: {
          x: x - barSpace.halfGapBar + 0.5,
          y: priceY[1],
          width: barSpace.gapBar - 1,
          height: Math.max(1, priceY[2] - priceY[1])
        },
        styles: {
          style: PolygonType.StrokeFill,
          color: colors[0],
          borderColor: colors[1]
        }
      }
    ]
  }

  private _createStrokeBar(x: number, priceY: number[], barSpace: BarSpace, colors: string[]): Array<FigureCreate<RectAttrs | RectAttrs[], Partial<RectStyle>>> {
    return [
      {
        name: 'rect',
        attrs: [
          {
            x: x - 0.5,
            y: priceY[0],
            width: 1,
            height: priceY[1] - priceY[0]
          },
          {
            x: x - 0.5,
            y: priceY[2],
            width: 1,
            height: priceY[3] - priceY[2]
          }
        ],
        styles: { color: colors[2] }
      },
      {
        name: 'rect',
        attrs: {
          x: x - barSpace.halfGapBar + 0.5,
          y: priceY[1],
          width: barSpace.gapBar - 1,
          height: Math.max(1, priceY[2] - priceY[1])
        },
        styles: {
          style: PolygonType.Stroke,
          borderColor: colors[1]
        }
      }
    ]
  }
}
