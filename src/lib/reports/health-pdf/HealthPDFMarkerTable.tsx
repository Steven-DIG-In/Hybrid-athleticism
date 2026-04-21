import { View, Text, StyleSheet } from '@react-pdf/renderer'
import { colors } from './HealthPDFPage'
import type { MarkerRow } from '@/lib/reports/types'

const s = StyleSheet.create({
  row: { flexDirection: 'row', paddingVertical: 3, borderBottomWidth: 0.25, borderBottomColor: colors.line },
  head: { flexDirection: 'row', paddingVertical: 4, borderBottomWidth: 0.5, borderBottomColor: colors.line },
  headCell: { fontSize: 8, color: colors.muted, textTransform: 'uppercase' },
  cell: { fontSize: 9, color: colors.ink },
  oor: { color: colors.amber },
  c1: { width: '40%' }, c2: { width: '15%', textAlign: 'right' },
  c3: { width: '15%', textAlign: 'right' }, c4: { width: '30%', textAlign: 'right' },
})

export function HealthPDFMarkerTable({ markers }: { markers: MarkerRow[] }) {
  return (
    <View>
      <View style={s.head}>
        <Text style={[s.headCell, s.c1]}>Marker</Text>
        <Text style={[s.headCell, s.c2]}>Value</Text>
        <Text style={[s.headCell, s.c3]}>Unit</Text>
        <Text style={[s.headCell, s.c4]}>Range</Text>
      </View>
      {markers.map(m => (
        <View style={s.row} key={m.name_en}>
          <Text style={[s.cell, s.c1, m.out_of_range ? s.oor : {}]}>{m.name_en}</Text>
          <Text style={[s.cell, s.c2, m.out_of_range ? s.oor : {}]}>{m.value ?? '—'}</Text>
          <Text style={[s.cell, s.c3]}>{m.unit ?? ''}</Text>
          <Text style={[s.cell, s.c4]}>{m.ref_low ?? '—'} – {m.ref_high ?? '—'}</Text>
        </View>
      ))}
    </View>
  )
}
