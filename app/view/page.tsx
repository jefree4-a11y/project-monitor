"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

/* ===================== 타입 ===================== */

type Project = {
  id: string;
  project_code: string;
  name: string;
  customer: string | null;
  install_location: string | null;
  order_date: string | null;
  due_date: string | null;
  status: string;
  pm_email: string | null;
};

type Stage = { id: string; name: string; sort_order: number };

type RoleKey = "pm" | "design" | "mech" | "control" | "safety";
type OwnerRow = Record<RoleKey, string>;

type Update = {
  id: string | null;
  project_id: string;
  stage_id: string;
  assignee: string | null;
  plan_date: string | null;
  actual_date: string | null;
  approve_date: string | null;

  remark_design_work: boolean;
  remark_outsource_design: boolean;

  vendor_assembly: string | null;
  vendor_install: string | null;
  vendor_control: string | null;
  vendor_program: string | null;

  memo: string | null;

  owner_pm?: string | null;
  owner_design?: string | null;
  owner_mech?: string | null;
  owner_control?: string | null;
  owner_safety?: string | null;
  owner_matrix?: any | null; // jsonb
};

/* ===================== 유틸 ===================== */

function normalize(v?: string | null) {
  return (v ?? "").trim();
}

function buildBaseRow(projectId: string, stageId: string): Update {
  return {
    id: null,
    project_id: projectId,
    stage_id: stageId,
    assignee: null,
    plan_date: null,
    actual_date: null,
    approve_date: null,
    remark_design_work: false,
    remark_outsource_design: false,
    vendor_assembly: null,
    vendor_install: null,
    vendor_control: null,
    vendor_program: null,
    memo: null,
    owner_pm: null,
    owner_design: null,
    owner_mech: null,
    owner_control: null,
    owner_safety: null,
    owner_matrix: null,
  };
}

/* ===================== 실제 페이지 내용 ===================== */

function ViewInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const projectId = sp.get("projectId") ?? "";

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [project, setProject] = useState<Project | null>(null);
  const [stages, setStages] = useState<Stage[]>([]);
  const [rows, setRows] = useState<Record<string, Update>>({});

  const stagesSorted = useMemo(() => {
    const list = [...stages];
    list.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    return list;
  }, [stages]);

  const ownerStageId = useMemo(() => {
    if (!stagesSorted.length) return "";
    return stagesSorted[0].id;
  }, [stagesSorted]);

  const ownerViewRows: OwnerRow[] = useMemo(() => {
    if (!ownerStageId) return [];
    const r = rows[ownerStageId];
    if (!r) return [];

    const m = r.owner_matrix;
    if (Array.isArray(m) && m.length > 0) {
      return m.map((x: any) => ({
        pm: x?.pm ?? "",
        design: x?.design ?? "",
        mech: x?.mech ?? "",
        control: x?.control ?? "",
        safety: x?.safety ?? "",
      }));
    }

    return [
      {
        pm: r.owner_pm ?? "",
        design: r.owner_design ?? "",
        mech: r.owner_mech ?? "",
        control: r.owner_control ?? "",
        safety: r.owner_safety ?? "",
      },
    ];
  }, [rows, ownerStageId]);

  useEffect(() => {
    if (!projectId) {
      setLoading(false);
      return;
    }

    (async () => {
      setLoading(true);
      setErrorMsg(null);

      try {
        const p = await supabase
          .from("projects")
          .select("id, project_code, name, customer, install_location, order_date, due_date, status, pm_email")
          .eq("id", projectId)
          .maybeSingle();

        setProject((p.data as Project) ?? null);

        const s = await supabase.from("stages").select("id, name, sort_order").order("sort_order");
        setStages((s.data ?? []) as Stage[]);

        const u = await supabase
          .from("stage_updates")
          .select(
            `
            id,
            project_id, stage_id, assignee,
            plan_date, actual_date, approve_date,
            remark_design_work, remark_outsource_design,
            vendor_assembly, vendor_install, vendor_control, vendor_program,
            memo,
            owner_pm, owner_design, owner_mech, owner_control, owner_safety, owner_matrix
          `
          )
          .eq("project_id", projectId);

        if (u.error) throw u.error;

        const stageList = (s.data ?? []) as Stage[];
        const sorted = [...stageList].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

        const base: Record<string, Update> = {};
        for (const st of sorted) base[st.id] = buildBaseRow(projectId, st.id);

        for (const item of (u.data ?? []) as any[]) {
          const stId = item.stage_id as string;
          if (!base[stId]) base[stId] = buildBaseRow(projectId, stId);
          base[stId] = { ...base[stId], ...item, id: item.id ?? null };
        }

        setRows(base);
      } catch (e: any) {
        setErrorMsg(e?.message ?? "데이터 로딩 중 오류가 발생했습니다.");
      } finally {
        setLoading(false);
      }
    })();
  }, [projectId]);

  async function goEdit() {
    if (!projectId) return;

    const editUrl = `/input?projectId=${projectId}`;
    const { data } = await supabase.auth.getSession();

    if (data.session) {
      router.push(editUrl);
      return;
    }

    router.push(`/login?redirectTo=${encodeURIComponent(editUrl)}`);
  }

  if (!projectId) {
    return (
      <div style={{ padding: 16 }}>
        <h2>프로젝트 단계별 현황 (조회)</h2>
        <div style={{ marginTop: 8, color: "#666" }}>projectId가 없습니다. 대시보드에서 프로젝트를 선택해 주세요.</div>
        <div style={{ marginTop: 12 }}>
          <a href="/dashboard">대시보드로 이동</a>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h2 style={{ margin: 0 }}>프로젝트 단계별 현황 (조회 전용)</h2>
          <div style={{ marginTop: 6, color: "#444" }}>
            {loading ? (
              "로딩 중..."
            ) : project ? (
              <>
                <b>{project.project_code}</b> / {project.name} / 상태: {project.status}
              </>
            ) : (
              "프로젝트를 찾을 수 없습니다."
            )}
          </div>
          {errorMsg && <div style={{ marginTop: 6, color: "red" }}>{errorMsg}</div>}
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            onClick={goEdit}
            style={{
              height: 36,
              padding: "0 14px",
              border: "1px solid #333",
              borderRadius: 8,
              background: "white",
              cursor: "pointer",
              fontWeight: 800,
            }}
          >
            수정
          </button>
          <a href="/dashboard">대시보드</a>
        </div>
      </div>

      {project && (
        <div
          style={{
            marginTop: 12,
            padding: 10,
            border: "1px solid #ddd",
            borderRadius: 6,
            display: "grid",
            gridTemplateColumns: "1fr 560px",
            gap: 16,
            alignItems: "start",
          }}
        >
          <div>
            <div>
              <b>고객사</b>: {project.customer ?? "-"}
            </div>
            <div>
              <b>설치위치</b>: {project.install_location ?? "-"}
            </div>
            <div>
              <b>수주일자</b>: {project.order_date ?? "-"}
            </div>
            <div>
              <b>납기일</b>: {project.due_date ?? "-"}
            </div>
            <div>
              <b>상태</b>: {project.status}
            </div>
            <div>
              <b>PM</b>: {project.pm_email ?? "-"}
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "center" }}>
            <div style={{ width: 520 }}>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}>
                <b style={{ fontSize: 13 }}>담당자 현황(조회)</b>
              </div>

              <div style={{ border: "1px solid #d0d7de", borderRadius: 6, overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
                  <thead>
                    <tr>
                      {["PM", "설계", "기계", "제어", "안전"].map((h) => (
                        <th key={h} style={thStyle}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {ownerViewRows.length ? (
                      ownerViewRows.map((r, idx) => (
                        <tr key={idx}>
                          {(["pm", "design", "mech", "control", "safety"] as RoleKey[]).map((k) => (
                            <td key={k} style={ownerTdStyle}>
                              <div style={ownerValueBox}>{normalize((r as any)[k]) || "-"}</div>
                            </td>
                          ))}
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} style={{ ...ownerTdStyle, textAlign: "center", padding: 10 }}>
                          -
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div style={{ marginTop: 6, fontSize: 12, color: "#64748b", textAlign: "center" }}>
                * 수정은 우측 상단 “수정” 버튼을 누르고 로그인 후 가능합니다.
              </div>
            </div>
          </div>
        </div>
      )}

      <div style={{ marginTop: 14 }}>
        <table border={1} cellPadding={4} style={{ borderCollapse: "collapse", width: "100%", fontSize: 13 }}>
          <thead>
            <tr>
              <th style={{ width: 180 }}>단계</th>
              <th style={{ width: 80, textAlign: "center" }}>담당자</th>
              <th style={{ width: 120 }}>계획일</th>
              <th style={{ width: 120 }}>실적일</th>
              <th style={{ width: 170 }}>승인일(품질관리팀)</th>
              <th style={{ width: 220 }}>비고</th>
              <th>메모</th>
            </tr>
          </thead>

          <tbody>
            {stagesSorted.map((st) => {
              const r = rows[st.id];
              return (
                <tr key={st.id}>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {st.sort_order}. {st.name}
                  </td>

                  <td style={{ verticalAlign: "middle", textAlign: "center" }}>{normalize(r?.assignee) || "-"}</td>
                  <td style={{ verticalAlign: "middle", textAlign: "center" }}>{r?.plan_date ? r.plan_date.slice(0, 10) : "-"}</td>
                  <td style={{ verticalAlign: "middle", textAlign: "center" }}>{r?.actual_date ? r.actual_date.slice(0, 10) : "-"}</td>
                  <td style={{ verticalAlign: "middle", textAlign: "center" }}>{r?.approve_date ? r.approve_date.slice(0, 10) : "-"}</td>

                  <td style={{ verticalAlign: "top" }}>
                    {st.sort_order === 7 ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-start" }}>
                        <div>설계업무: {r?.remark_design_work ? "✅" : "-"}</div>
                        <div>외주설계: {r?.remark_outsource_design ? "✅" : "-"}</div>
                      </div>
                    ) : st.sort_order === 8 ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <div>● 조립: {normalize(r?.vendor_assembly) || "-"}</div>
                        <div>● 설치: {normalize(r?.vendor_install) || "-"}</div>
                        <div>● 제어: {normalize(r?.vendor_control) || "-"}</div>
                        <div>● 프로그램: {normalize(r?.vendor_program) || "-"}</div>
                      </div>
                    ) : (
                      "-"
                    )}
                  </td>

                  <td style={{ verticalAlign: "top", whiteSpace: "pre-wrap" }}>{normalize(r?.memo) || "-"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ===================== Suspense Wrapper ===================== */

export default function ViewPage() {
  return (
    <Suspense fallback={<div style={{ padding: 16 }}>로딩중...</div>}>
      <ViewInner />
    </Suspense>
  );
}

/* ===================== 스타일 ===================== */

const thStyle: React.CSSProperties = {
  background: "#3b82f6",
  color: "white",
  fontSize: 12,
  padding: "6px 8px",
  textAlign: "center",
};

const ownerTdStyle: React.CSSProperties = {
  borderTop: "1px solid #e5e7eb",
  borderRight: "1px solid #e5e7eb",
  padding: 4,
  background: "#f8fafc",
};

const ownerValueBox: React.CSSProperties = {
  width: "100%",
  minHeight: 26,
  border: "1px solid #cbd5e1",
  borderRadius: 4,
  padding: "0 8px",
  fontSize: 12,
  display: "flex",
  alignItems: "center",
  background: "white",
};