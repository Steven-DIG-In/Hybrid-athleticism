import { View, Text, StyleSheet } from '@react-pdf/renderer'
import { colors } from './HealthPDFPage'

const styles = StyleSheet.create({
  section: { marginBottom: 18 },
  title: { fontSize: 13, color: colors.ink, marginBottom: 8, fontFamily: 'Helvetica-Bold' },
})

export function HealthPDFSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <View style={styles.section}><Text style={styles.title}>{title}</Text>{children}</View>
}
