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

type HistoryRow = {
  id: number;
  action: "INSERT" | "UPDATE" | "DELETE";
  changed_at: string;
  stage_id: string;
  changed_by_name: string | null;
  changed_by_email: string | null;
  old_row: any | null;
  new_row: any | null;
};

/* ===================== 유틸 ===================== */

function normalize(v?: string | null) {
  return (v ?? "").trim();
}

function date10(v?: string | null) {
  const t = normalize(v);
  return t ? t.slice(0, 10) : "";
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

const DIFF_KEYS = [
  "assignee",
  "plan_date",
  "actual_date",
  "approve_date",
  "meeting_type",
  "remark_design_work",
  "remark_outsource_design",
  "vendor_assembly",
  "vendor_install",
  "vendor_control",
  "vendor_program",
  "memo",
];

function diffSummary(oldRow: any, newRow: any) {
  const o = oldRow ?? {};
  const n = newRow ?? {};
  const changes: { key: string; from: any; to: any }[] = [];

  for (const k of DIFF_KEYS) {
    const a = o[k];
    const b = n[k];
    const same = JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
    if (!same) changes.push({ key: k, from: a ?? null, to: b ?? null });
  }
  return changes;
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

  // ----- 이력 모달 상태 -----
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyStage, setHistoryStage] = useState<Stage | null>(null);
  const [historyItems, setHistoryItems] = useState<HistoryRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const stagesSorted = useMemo(() => {
    const list = [...stages];
    list.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    return list;
  }, [stages]);

  // 담당자 현황은 “첫 단계(정렬상 1등)” row에서 꺼냄
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
        if (s.error) throw s.error;
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

  // ✅ 수정 버튼: 로그인 안 되어 있으면 로그인으로 → 로그인 성공 후 입력화면으로
  async function goEdit() {
    if (!projectId) return;

    const editUrl = `/input?projectId=${encodeURIComponent(projectId)}`;
    const { data } = await supabase.auth.getSession();

    if (data.session) {
      router.push(editUrl);
      return;
    }

    router.push(`/login?redirectTo=${encodeURIComponent(editUrl)}`);
  }

  // ✅ 단계 이력 조회 + 모달 오픈
  async function openHistory(st: Stage) {
    if (!projectId) return;
    setHistoryStage(st);
    setHistoryOpen(true);
    setHistoryLoading(true);
    setHistoryError(null);
    setHistoryItems([]);

    const { data, error } = await supabase
      .from("stage_updates_history")
      .select("id, action, changed_at, stage_id, changed_by_name, changed_by_email, old_row, new_row")
      .eq("project_id", projectId)
      .eq("stage_id", st.id)
      .order("changed_at", { ascending: false })
      .limit(200);

    if (error) {
      setHistoryError(error.message);
      setHistoryLoading(false);
      return;
    }

    setHistoryItems((data ?? []) as any);
    setHistoryLoading(false);
  }

  function closeHistory() {
    setHistoryOpen(false);
    setHistoryStage(null);
    setHistoryItems([]);
    setHistoryError(null);
    setHistoryLoading(false);
  }

  // ESC로 모달 닫기
  useEffect(() => {
    if (!historyOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeHistory();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyOpen]);

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

  const tdCenter: React.CSSProperties = { verticalAlign: "middle", textAlign: "center" };
  const tdTop: React.CSSProperties = { verticalAlign: "top" };

  return (
    <div style={{ padding: 16 }}>
      {/* ===== 헤더 ===== */}
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

      {/* ===== 프로젝트 + 담당자 현황 ===== */}
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

      {/* ===== 단계 테이블 ===== */}
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
              <th style={{ width: 90 }}>이력보기</th>
            </tr>
          </thead>

          <tbody>
            {stagesSorted.map((st) => {
              const r = rows[st.id];

              return (
                <tr key={st.id}>
                  {/* ✅ 단계 표기 = id + name */}
                  <td style={{ whiteSpace: "nowrap" }}>
                    {st.id}. {st.name}
                  </td>

                  <td style={tdCenter}>
                    <input style={{ width: 70, textAlign: "center" }} value={normalize(r?.assignee)} readOnly disabled />
                  </td>

                  <td style={tdCenter}>
                    <input type="date" value={date10(r?.plan_date)} readOnly disabled />
                  </td>

                  <td style={tdCenter}>
                    <input type="date" value={date10(r?.actual_date)} readOnly disabled />
                  </td>

                  <td style={tdCenter}>
                    <input type="date" value={date10(r?.approve_date)} readOnly disabled />
                  </td>

                  {/* ✅ 비고: 점검회의(id="7") / 업체선정(id="8") */}
                  <td style={tdTop}>
                    {st.id === "7" ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-start" }}>
                        <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          <input type="checkbox" checked={!!r?.remark_design_work} readOnly disabled />
                          설계업무
                        </label>
                        <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          <input type="checkbox" checked={!!r?.remark_outsource_design} readOnly disabled />
                          외주설계
                        </label>
                      </div>
                    ) : st.id === "8" ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {[
                          ["vendor_assembly", "조립"],
                          ["vendor_install", "설치"],
                          ["vendor_control", "제어"],
                          ["vendor_program", "프로그램"],
                        ].map(([key, label]) => (
                          <div key={key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ width: 80 }}>● {label}</span>
                            <input style={{ width: 140 }} value={normalize((r as any)?.[key])} readOnly disabled />
                          </div>
                        ))}
                      </div>
                    ) : (
                      "-"
                    )}
                  </td>

                  <td style={tdTop}>
                    <textarea
                      value={r?.memo ?? ""}
                      readOnly
                      disabled
                      rows={1}
                      style={{
                        width: "100%",
                        minHeight: 28,
                        resize: "none",
                        overflow: "hidden",
                        lineHeight: "18px",
                      }}
                    />
                  </td>

                  {/* ✅ 이력보기 */}
                  <td style={{ ...tdTop, textAlign: "center" }}>
                    <button type="button" onClick={() => openHistory(st)} style={historyBtn}>
                      이력보기
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ===== 이력 모달 ===== */}
      {historyOpen && (
        <div style={overlay} onClick={closeHistory}>
          <div style={modal} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
              <div>
                <div style={{ fontWeight: 900, fontSize: 16 }}>
                  이력보기 - {historyStage?.id}. {historyStage?.name}
                </div>
                <div style={{ marginTop: 4, fontSize: 12, color: "#64748b" }}>
                  {project?.project_code} / {project?.name}
                </div>
              </div>
              <button onClick={closeHistory} style={closeBtn}>
                닫기
              </button>
            </div>

            <div style={{ marginTop: 12, maxHeight: "70vh", overflowY: "auto", paddingRight: 4 }}>
              {historyLoading ? (
                <div>로딩 중...</div>
              ) : historyError ? (
                <div style={{ color: "red" }}>{historyError}</div>
              ) : historyItems.length === 0 ? (
                <div style={{ color: "#666" }}>이 단계의 변경 이력이 없습니다.</div>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {historyItems.map((h) => {
                    const changes = diffSummary(h.old_row, h.new_row);
                    const who = (h.changed_by_name || "-") + (h.changed_by_email ? ` (${h.changed_by_email})` : "");

                    return (
                      <div key={h.id} style={historyCard}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                          <div style={{ fontSize: 12, color: "#334155" }}>
                            <b>{h.action}</b> · {new Date(h.changed_at).toLocaleString()}
                          </div>
                          <div style={{ fontSize: 12, color: "#64748b" }}>{who}</div>
                        </div>

                        <div style={{ marginTop: 8, fontSize: 12 }}>
                          {changes.length === 0 ? (
                            <div style={{ color: "#64748b" }}>변경 필드가 감지되지 않았습니다.</div>
                          ) : (
                            <ul style={{ margin: 0, paddingLeft: 16 }}>
                              {changes.map((c) => (
                                <li key={c.key}>
                                  <b>{c.key}</b>: {String(c.from)} → {String(c.to)}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div style={{ marginTop: 10, fontSize: 12, color: "#64748b" }}>
              * ESC 키 또는 바깥 영역 클릭으로 닫을 수 있습니다.
            </div>
          </div>
        </div>
      )}
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

const historyBtn: React.CSSProperties = {
  padding: "4px 8px",
  border: "1px solid #cbd5e1",
  borderRadius: 6,
  background: "white",
  cursor: "pointer",
  fontSize: 12,
};

const overlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.35)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
  zIndex: 2000,
};

const modal: React.CSSProperties = {
  width: "min(900px, 100%)",
  background: "white",
  borderRadius: 12,
  padding: 16,
  boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
};

const closeBtn: React.CSSProperties = {
  padding: "6px 10px",
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  background: "white",
  cursor: "pointer",
};

const historyCard: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 10,
  padding: 10,
  background: "white",
};