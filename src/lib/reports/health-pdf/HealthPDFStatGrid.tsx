import { View, Text, StyleSheet } from '@react-pdf/renderer'
import { colors } from './HealthPDFPage'

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '50%', marginBottom: 6 },
  label: { fontSize: 8, color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.4 },
  value: { fontSize: 14, color: colors.ink, marginTop: 2 },
})

export function HealthPDFStatGrid({ items }: { items: { label: string; value: string }[] }) {
  return (
    <View style={styles.grid}>
      {items.map(i => (
        <View key={i.label} style={styles.cell}>
          <Text style={styles.label}>{i.label}</Text>
          <Text style={styles.value}>{i.value}</Text>
        </View>
      ))}
    </View>
  )
}
