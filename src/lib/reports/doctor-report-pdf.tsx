import { Document, View, Text, StyleSheet } from '@react-pdf/renderer'
import type { DoctorReportSnapshot } from './types'
import { HealthPDFPage, colors } from './health-pdf/HealthPDFPage'
import { HealthPDFSection } from './health-pdf/HealthPDFSection'
import { HealthPDFMarkerTable } from './health-pdf/HealthPDFMarkerTable'
import { HealthPDFTrendChart } from './health-pdf/HealthPDFTrendChart'
import { HealthPDFTimeline } from './health-pdf/HealthPDFTimeline'

const s = StyleSheet.create({
  coverTitle: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: colors.ink, marginBottom: 4 },
  coverSub: { fontSize: 10, color: colors.muted, marginBottom: 14 },
  summary: { fontSize: 11, color: colors.ink, lineHeight: 1.4 },
  panelTitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: colors.ink, marginTop: 8, marginBottom: 4 },
  supplementRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  supplementName: { fontSize: 10, color: colors.ink },
  supplementMeta: { fontSize: 8, color: colors.muted },
})

export function DoctorReportPDF({ snapshot }: { snapshot: DoctorReportSnapshot }) {
  const footer = 'Not a medical diagnosis. Discuss abnormal values with physician.'
  return (
    <Document>
      {/* Cover + summary */}
      <HealthPDFPage footerText={footer}>
        <Text style={s.coverTitle}>{snapshot.athlete_name} — Health report</Text>
        <Text style={s.coverSub}>
          Window: {snapshot.window.start} to {snapshot.window.end} ·
          Generated {snapshot.generated_at.slice(0, 10)}
        </Text>
        <Text style={s.summary}>{snapshot.summary_line}</Text>

        <HealthPDFSection title="Bloodwork">
          {snapshot.bloodwork_panels.length === 0 ? (
            <Text style={{ fontSize: 9, color: colors.muted }}>No data in selected window.</Text>
          ) : snapshot.bloodwork_panels.map(p => (
            <View key={p.id}>
              <Text style={s.panelTitle}>{p.panel_date} · {p.lab_name ?? 'Manual entry'}</Text>
              <HealthPDFMarkerTable markers={p.markers} />
            </View>
          ))}
        </HealthPDFSection>
      </HealthPDFPage>

      {/* Garmin trends page */}
      <HealthPDFPage footerText={footer}>
        <HealthPDFSection title="Garmin daily trends">
          {snapshot.garmin.sleep_daily.length === 0 ? (
            <Text style={{ fontSize: 9, color: colors.muted }}>No data in selected window.</Text>
          ) : (
            <>
              <HealthPDFTrendChart title="Sleep (min)" data={snapshot.garmin.sleep_daily} />
              <HealthPDFTrendChart title="HRV (overnight avg)" data={snapshot.garmin.hrv_daily} />
              <HealthPDFTrendChart title="Resting HR" data={snapshot.garmin.rhr_daily} />
              <HealthPDFTrendChart title="VO2 Max" data={snapshot.garmin.vo2_trend} />
            </>
          )}
        </HealthPDFSection>

        <HealthPDFSection title="Supplements">
          {snapshot.supplements.length === 0 ? (
            <Text style={{ fontSize: 9, color: colors.muted }}>No data in selected window.</Text>
          ) : snapshot.supplements.map(sup => (
            <View key={sup.name} style={s.supplementRow}>
              <Text style={s.supplementName}>
                {sup.name}{sup.dose ? ` ${sup.dose}${sup.dose_unit}` : ''}{sup.timing.length ? ` (${sup.timing.join(', ')})` : ''}
              </Text>
              <Text style={s.supplementMeta}>
                {sup.start_date}{sup.end_date ? ` → ${sup.end_date}` : ''}
              </Text>
            </View>
          ))}
        </HealthPDFSection>

        <HealthPDFSection title="Medicals">
          {snapshot.medicals.length === 0 ? (
            <Text style={{ fontSize: 9, color: colors.muted }}>No data in selected window.</Text>
          ) : <HealthPDFTimeline items={snapshot.medicals} />}
        </HealthPDFSection>

        <HealthPDFSection title="Body composition">
          {snapshot.body_comp.length === 0 ? (
            <Text style={{ fontSize: 9, color: colors.muted }}>No data in selected window.</Text>
          ) : (
            <HealthPDFTrendChart
              title="Weight (kg)"
              data={snapshot.body_comp
                .filter(b => b.weight_kg != null)
                .map(b => ({ date: b.measured_on, value: b.weight_kg as number }))}
            />
          )}
        </HealthPDFSection>
      </HealthPDFPage>
    </Document>
  )
}
