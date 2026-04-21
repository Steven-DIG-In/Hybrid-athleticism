import { Page, View, Text, StyleSheet } from '@react-pdf/renderer'

export const colors = {
  ink: '#1a1410',
  muted: '#5a4f47',
  amber: '#92400e',
  line: '#d6cfc7',
  paper: '#fbf9f6',
}

const styles = StyleSheet.create({
  page: {
    backgroundColor: colors.paper, color: colors.ink,
    paddingTop: 36, paddingBottom: 36, paddingHorizontal: 40,
    fontSize: 10, fontFamily: 'Helvetica',
  },
  footer: {
    position: 'absolute', bottom: 18, left: 40, right: 40,
    fontSize: 8, color: colors.muted,
    borderTopWidth: 0.5, borderTopColor: colors.line, paddingTop: 6,
  },
})

export function HealthPDFPage({ children, footerText }: { children: React.ReactNode; footerText?: string }) {
  return (
    <Page size="A4" style={styles.page}>
      <View>{children}</View>
      {footerText && <Text style={styles.footer} fixed>{footerText}</Text>}
    </Page>
  )
}
