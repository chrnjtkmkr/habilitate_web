import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { generateReportContent, type ReportContent } from '../reports/generate';
import type { Database } from '../../types/supabase';

type ReportStatus = Database['public']['Enums']['report_status'];

export function useParentReports(childId: string | undefined) {
  return useQuery({
    queryKey: ['parent-reports', childId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('parent_reports')
        .select('*')
        .eq('child_id', childId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!childId,
  });
}

export function useParentReport(reportId: string | undefined) {
  return useQuery({
    queryKey: ['parent-report', reportId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('parent_reports')
        .select(
          '*, child:children!parent_reports_child_id_fkey(full_name, date_of_birth), therapist:profiles!parent_reports_generated_by_fkey(full_name), approver:profiles!parent_reports_approved_by_fkey(full_name)',
        )
        .eq('id', reportId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!reportId,
  });
}

export function useGenerateReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      childId,
      centerId,
      periodStart,
      periodEnd,
      language,
      actorId,
    }: {
      childId: string;
      centerId: string;
      periodStart: string;
      periodEnd: string;
      language: 'en' | 'hi';
      actorId: string;
    }) => {
      const content = await generateReportContent(
        childId,
        periodStart,
        periodEnd,
        language,
      );

      const { data, error } = await supabase
        .from('parent_reports')
        .insert({
          child_id: childId,
          center_id: centerId,
          period_start: periodStart,
          period_end: periodEnd,
          language,
          content: content as unknown as Database['public']['Tables']['parent_reports']['Insert']['content'],
          status: 'draft' as ReportStatus,
          generated_by: actorId,
        })
        .select('id')
        .single();
      if (error) throw error;

      await supabase.from('audit_log').insert({
        action: 'report.generated',
        actor_id: actorId,
        center_id: centerId,
        entity_id: data.id,
        entity_type: 'parent_report',
      });

      return data.id;
    },
    onSuccess: (_id, vars) => {
      qc.invalidateQueries({ queryKey: ['parent-reports', vars.childId] });
    },
  });
}

export function useUpdateReportContent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      reportId,
      content,
      actorId,
      centerId,
    }: {
      reportId: string;
      content: ReportContent;
      actorId: string;
      centerId: string;
    }) => {
      const { data, error } = await supabase
        .from('parent_reports')
        .update({
          content: content as unknown as Database['public']['Tables']['parent_reports']['Update']['content'],
        })
        .eq('id', reportId)
        .select('id');
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error('Save failed — you may no longer have access to this record. Refresh and try again.');
      }

      await supabase.from('audit_log').insert({
        action: 'report.edited',
        actor_id: actorId,
        center_id: centerId,
        entity_id: reportId,
        entity_type: 'parent_report',
      });
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['parent-report', vars.reportId] });
      qc.invalidateQueries({ queryKey: ['parent-reports'] });
    },
  });
}

export function useSendForApproval() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      reportId,
      actorId,
      centerId,
    }: {
      reportId: string;
      actorId: string;
      centerId: string;
    }) => {
      const { data, error } = await supabase
        .from('parent_reports')
        .update({ status: 'awaiting_approval' as ReportStatus })
        .eq('id', reportId)
        .select('id');
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error('Save failed — you may no longer have access to this record. Refresh and try again.');
      }

      await supabase.from('audit_log').insert({
        action: 'report.sent_for_approval',
        actor_id: actorId,
        center_id: centerId,
        entity_id: reportId,
        entity_type: 'parent_report',
      });
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['parent-report', vars.reportId] });
      qc.invalidateQueries({ queryKey: ['parent-reports'] });
    },
  });
}

export function useApproveReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      reportId,
      actorId,
      centerId,
    }: {
      reportId: string;
      actorId: string;
      centerId: string;
    }) => {
      const { data, error } = await supabase
        .from('parent_reports')
        .update({
          status: 'approved' as ReportStatus,
          approved_by: actorId,
          approved_at: new Date().toISOString(),
        })
        .eq('id', reportId)
        .select('id');
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error('Save failed — you may no longer have access to this record. Refresh and try again.');
      }

      await supabase.from('audit_log').insert({
        action: 'report.approved',
        actor_id: actorId,
        center_id: centerId,
        entity_id: reportId,
        entity_type: 'parent_report',
      });
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['parent-report', vars.reportId] });
      qc.invalidateQueries({ queryKey: ['parent-reports'] });
    },
  });
}

export function useRenderReportPdf() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      reportId,
      childId,
      centerId,
      actorId,
      previewElement,
      filename,
    }: {
      reportId: string;
      childId: string;
      centerId: string;
      actorId: string;
      previewElement: HTMLElement;
      filename: string;
    }) => {
      const { generateAndUploadReportPdf } = await import('../reports/clientPdf');
      const { pdfUrl } = await generateAndUploadReportPdf({
        reportId,
        centerId,
        childId,
        previewElement,
        filename,
      });

      await supabase.from('audit_log').insert({
        action: 'report.pdf_rendered',
        actor_id: actorId,
        center_id: centerId,
        entity_id: reportId,
        entity_type: 'parent_report',
      });

      return pdfUrl;
    },
    onSuccess: (_url, vars) => {
      qc.invalidateQueries({ queryKey: ['parent-report', vars.reportId] });
    },
  });
}
