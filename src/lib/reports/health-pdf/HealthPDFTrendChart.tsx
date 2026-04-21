import { View, Text, Svg, Polyline, StyleSheet } from '@react-pdf/renderer'
import { colors } from './HealthPDFPage'

const s = StyleSheet.create({
  wrap: { marginBottom: 6 },
  label: { fontSize: 8, color: colors.muted, marginBottom: 2 },
})

export function HealthPDFTrendChart({
  title, data, width = 220, height = 60,
}: { title: string; data: { date: string; value: number }[]; width?: number; height?: number }) {
  if (data.length === 0) {
    return <View style={s.wrap}><Text style={s.label}>{title}: no data</Text></View>
  }
  const max = Math.max(...data.map(d => d.value))
  const min = Math.min(...data.map(d => d.value))
  const range = max - min || 1
  const pts = data.map((d, i) => {
    const x = (i / Math.max(1, data.length - 1)) * width
    const y = height - ((d.value - min) / range) * height
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  return (
    <View style={s.wrap}>
      <Text style={s.label}>{title}</Text>
      <Svg width={width} height={height}>
        <Polyline points={pts} stroke={colors.amber} strokeWidth={1} fill="none" />
      </Svg>
    </View>
  )
}
