import { View, Text, StyleSheet } from '@react-pdf/renderer'
import { colors } from './HealthPDFPage'

const s = StyleSheet.create({
  item: { marginBottom: 8 },
  head: { flexDirection: 'row', marginBottom: 2 },
  badge: {
    fontSize: 8, borderWidth: 0.5, borderColor: colors.line,
    paddingHorizontal: 4, paddingVertical: 1, marginRight: 6, color: colors.muted,
  },
  date: { fontSize: 8, color: colors.muted },
  title: { fontSize: 10, color: colors.ink },
  details: { fontSize: 9, color: colors.muted, marginTop: 2 },
})

export function HealthPDFTimeline({ items }: { items: {
  event_type: string; event_date: string; title: string; details: string | null
}[] }) {
  return (
    <View>
      {items.map((e, i) => (
        <View key={i} style={s.item}>
          <View style={s.head}>
            <Text style={s.badge}>{e.event_type}</Text>
            <Text style={s.date}>{e.event_date}</Text>
          </View>
          <Text style={s.title}>{e.title}</Text>
          {e.details && <Text style={s.details}>{e.details}</Text>}
        </View>
      ))}
    </View>
  )
}
