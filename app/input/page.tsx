"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

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

type Update = {
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
};

export default function InputPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [projectId, setProjectId] = useState<string>("");
  const [urlProjectId, setUrlProjectId] = useState<string>("");

function addDaysISO(base: string, days: number) {
  // base: "YYYY-MM-DD"
  const d = new Date(`${base}T00:00:00`);
  d.setDate(d.getDate() + days);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}



  // stage_id -> row
  const [rows, setRows] = useState<Record<string, Update>>({});

  // ---- 프로젝트 추가 모달 상태 ----
  const [open, setOpen] = useState(false);

  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [newCustomer, setNewCustomer] = useState("");
  const [newInstallLocation, setNewInstallLocation] = useState(""); // 설치위치
  const [newOrderDate, setNewOrderDate] = useState(""); // 수주일자
  const [newDueDate, setNewDueDate] = useState(""); // 납기일
  const [newStatus, setNewStatus] = useState("진행");
  const [newPmEmail, setNewPmEmail] = useState("");

  // 1) 프로젝트 목록 갱신
  async function refreshProjects(selectId?: string) {
    const p = await supabase
      .from("projects")
      .select("id, project_code, name, customer, install_location, order_date, due_date, status, pm_email")
      .order("project_code");

    const list = (p.data ?? []) as Project[];
    setProjects(list);

    if (selectId) {
      setProjectId(selectId);
      return;
    }

    // URL에서 넘어온 프로젝트가 있으면 우선 선택
    if (urlProjectId) {
      setProjectId(urlProjectId);
      return;
    }

    // URL이 없으면 첫 프로젝트 자동 선택
    if (!projectId && list.length > 0) {
      setProjectId(list[0].id);
    }
  }

  // 2-1) URL에서 projectId 읽기 (useSearchParams 없이)
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("projectId") || "";
    setUrlProjectId(id);
  }, []);

  // 2-2) 단계 목록 로딩 + 프로젝트 목록 로딩
  // urlProjectId가 세팅된 뒤에 실행되도록 의존성 추가
  useEffect(() => {
    (async () => {
      await refreshProjects(urlProjectId || undefined);

      const s = await supabase.from("stages").select("id, name, sort_order").order("sort_order");
      setStages((s.data ?? []) as Stage[]);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlProjectId]);

  // 3) 프로젝트 선택 시 해당 프로젝트의 stage_updates 불러오기
  useEffect(() => {
    if (!projectId || stages.length === 0) return;

    (async () => {
      const u = await supabase
        .from("stage_updates")
        .select(`
          project_id, stage_id, assignee,
          plan_date, actual_date, approve_date,
          remark_design_work, remark_outsource_design,
          vendor_assembly, vendor_install, vendor_control, vendor_program,
          memo
        `)
        .eq("project_id", projectId);

      // 기본 틀 생성
      const base: Record<string, Update> = {};
      for (const st of stages) {
        base[st.id] = {
          project_id: projectId,
          stage_id: st.id,
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
        };
      }

      for (const item of (u.data ?? []) as Update[]) {
        base[item.stage_id] = item;
      }

      setRows(base);
    })();
  }, [projectId, stages]);

  function setField(stageId: string, key: keyof Update, value: any) {
    setRows((prev) => ({
      ...prev,
      [stageId]: { ...prev[stageId], [key]: value },
    }));
  }

  // 4) 단계 입력값 저장
  async function saveAll() {
    if (!projectId) return alert("프로젝트를 먼저 선택하세요.");

    const payload = Object.values(rows).map((r) => ({
      project_id: projectId,
      stage_id: r.stage_id,
      assignee: r.assignee || null,
      plan_date: r.plan_date || null,
      actual_date: r.actual_date || null,
      approve_date: r.approve_date || null,

      remark_design_work: !!r.remark_design_work,
      remark_outsource_design: !!r.remark_outsource_design,

      vendor_assembly: r.vendor_assembly || null,
      vendor_install: r.vendor_install || null,
      vendor_control: r.vendor_control || null,
      vendor_program: r.vendor_program || null,

      memo: r.memo || null,
      updated_at: new Date().toISOString(),
    }));

    const { error } = await supabase.from("stage_updates").upsert(payload, { onConflict: "project_id,stage_id" });

    if (error) return alert(error.message);
    alert("저장 완료!");
  }

  // 5) 프로젝트 추가(INSERT)
  async function addProject() {
    if (!newCode.trim()) return alert("프로젝트 코드가 필요합니다.");
    if (!newName.trim()) return alert("프로젝트명이 필요합니다.");

    const { data, error } = await supabase
      .from("projects")
      .insert([
        {
          project_code: newCode.trim(),
          name: newName.trim(),
          customer: newCustomer.trim() || null,
          install_location: newInstallLocation.trim() || null,
          order_date: newOrderDate || null,
          due_date: newDueDate || null,
          status: newStatus,
          pm_email: newPmEmail.trim() || null,
        },
      ])
      .select("id")
      .single();

    if (error) return alert(error.message);

    // 폼 초기화
    setNewCode("");
    setNewName("");
    setNewCustomer("");
    setNewInstallLocation("");
    setNewOrderDate("");
    setNewDueDate("");
    setNewStatus("진행");
    setNewPmEmail("");

    setOpen(false);

    // 프로젝트 목록 갱신 + 방금 추가한 프로젝트 선택
    await refreshProjects(data.id);
    alert("프로젝트가 추가되었습니다.");
  }

  const selected = projects.find((p) => p.id === projectId);

  return (
    <div
      style={{
        padding: 16,
        height: "100vh",
        overflowY: "auto",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <h2 style={{ margin: 0 }}>입력화면 (PM용)</h2>

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setOpen(true)}>+ 프로젝트 추가</button>
          <button onClick={saveAll}>전체 저장</button>
          <a href="/dashboard" style={{ alignSelf: "center" }}>
            대시보드
          </a>
        </div>
      </div>

      {/* 프로젝트 선택 */}
      <div style={{ marginTop: 12, marginBottom: 12 }}>
        <label>프로젝트 선택: </label>
        <select value={projectId} onChange={(e) => setProjectId(e.target.value)} style={{ marginLeft: 8 }}>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.project_code} - {p.name}
            </option>
          ))}
        </select>

        {/* 선택 프로젝트 정보(상단 표시) */}
        {selected && (
          <div style={{ marginTop: 10, padding: 10, border: "1px solid #ddd", borderRadius: 6 }}>
            <div>
              <b>고객사</b>: {selected.customer ?? "-"}
            </div>
            <div>
              <b>설치위치</b>: {selected.install_location ?? "-"}
            </div>
            <div>
              <b>수주일자</b>: {selected.order_date ?? "-"}
            </div>
            <div>
              <b>납기일</b>: {selected.due_date ?? "-"}
            </div>
            <div>
              <b>상태</b>: {selected.status}
            </div>
            <div>
              <b>PM</b>: {selected.pm_email ?? "-"}
            </div>
          </div>
        )}
      </div>

      {/* 단계 입력 테이블 */}
      <table border={1} cellPadding={6} style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr>
            <th>단계</th>
            <th>담당자</th>
            <th>계획일</th>
            <th>실적일</th>
            <th>승인일(품질관리팀)</th>
            <th style={{ width: 180 }}>비고</th>
            <th style={{ width: 420 }}>메모</th>
          </tr>
        </thead>

        <tbody>
          {stages.map((st) => (
            <tr key={st.id}>
              <td style={{ whiteSpace: "nowrap" }}>
                {st.id}. {st.name}
              </td>

              <td>
                <input
                  style={{ width: 120 }}
                  value={rows[st.id]?.assignee ?? ""}
                  onChange={(e) => setField(st.id, "assignee", e.target.value)}
                  placeholder="담당자"
                />
              </td>

<input
  type="date"
  value={rows[st.id]?.plan_date ?? ""}
  onChange={(e) => {
    const v = e.target.value || null;

    // 1) 현재 단계 plan_date 저장
    setField(st.id, "plan_date", v);

    // 2) ✅ 1. 작업지시서(plan) 입력 시 2~5 자동 계산
    //    ※ 단계 id가 "1","2","3","4","5" 라는 가정 (지금 화면 표기와 동일)
    if (st.id === "1" && v) {
      setRows((prev) => ({
        ...prev,
        ["1"]: { ...prev["1"], plan_date: v },
        ["2"]: { ...prev["2"], plan_date: addDaysISO(v, 7) },
        ["3"]: { ...prev["3"], plan_date: addDaysISO(v, 10) },
        ["4"]: { ...prev["4"], plan_date: addDaysISO(v, 12) },
        ["5"]: { ...prev["5"], plan_date: addDaysISO(v, 14) },
      }));
    }
  }}
/>

              <td>
                <input
                  type="date"
                  value={rows[st.id]?.actual_date ?? ""}
                  onChange={(e) => setField(st.id, "actual_date", e.target.value || null)}
                />
              </td>

              <td>
                <input
                  type="date"
                  value={rows[st.id]?.approve_date ?? ""}
                  onChange={(e) => setField(st.id, "approve_date", e.target.value || null)}
                />
              </td>

              {/* 비고 */}
              <td style={{ verticalAlign: "top" }}>
                {st.id === "7-1" ? (
                  // 7-1 CHECK SHEET
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-start" }}>
                    <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <input
                        type="checkbox"
                        checked={!!rows[st.id]?.remark_design_work}
                        onChange={(e) => setField(st.id, "remark_design_work", e.target.checked)}
                      />
                      설계업무
                    </label>

                    <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <input
                        type="checkbox"
                        checked={!!rows[st.id]?.remark_outsource_design}
                        onChange={(e) => setField(st.id, "remark_outsource_design", e.target.checked)}
                      />
                      외주설계
                    </label>
                  </div>
                ) : st.id === "8" ? (
                  // 8. 업체선정
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {[
                      ["vendor_assembly", "조립"],
                      ["vendor_install", "설치"],
                      ["vendor_control", "제어"],
                      ["vendor_program", "프로그램"],
                    ].map(([key, label]) => (
                      <div key={key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ width: 80 }}>● {label}</span>
                        <input
                          style={{ width: 120 }}
                          value={(rows[st.id] as any)?.[key] ?? ""}
                          onChange={(e) => setField(st.id, key as any, e.target.value)}
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  "-"
                )}
              </td>

              {/* 메모 */}
              <td style={{ verticalAlign: "top" }}>
                <textarea
                  value={rows[st.id]?.memo ?? ""}
                  onChange={(e) => {
                    setField(st.id, "memo", e.target.value);

                    // 자동 높이 조절
                    e.target.style.height = "auto";
                    e.target.style.height = e.target.scrollHeight + "px";
                  }}
                  rows={1}
                  style={{
                    width: "100%",
                    minWidth: 380,
                    minHeight: 28,
                    resize: "none",
                    overflow: "hidden",
                    lineHeight: "18px",
                  }}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ---- 프로젝트 추가 모달 ---- */}
      {open && (
        <div style={overlay}>
          <div style={modal}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              <h3 style={{ margin: 0 }}>프로젝트 추가</h3>
              <button onClick={() => setOpen(false)}>닫기</button>
            </div>

            <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "140px 1fr", gap: 10 }}>
              <label>프로젝트 코드*</label>
              <input value={newCode} onChange={(e) => setNewCode(e.target.value)} placeholder="예: S25111" />

              <label>프로젝트명*</label>
              <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="예: 명화공업/둔포3공장" />

              <label>고객사</label>
              <input value={newCustomer} onChange={(e) => setNewCustomer(e.target.value)} />

              <label>설치위치</label>
              <input value={newInstallLocation} onChange={(e) => setNewInstallLocation(e.target.value)} placeholder="예: 둔포3공장" />

              <label>수주일자</label>
              <input type="date" value={newOrderDate} onChange={(e) => setNewOrderDate(e.target.value)} />

              <label>납기일</label>
              <input type="date" value={newDueDate} onChange={(e) => setNewDueDate(e.target.value)} />

              <label>상태</label>
              <select value={newStatus} onChange={(e) => setNewStatus(e.target.value)}>
                <option value="진행">진행</option>
                <option value="보류">보류</option>
                <option value="완료">완료</option>
              </select>

              <label>PM 이메일</label>
              <input value={newPmEmail} onChange={(e) => setNewPmEmail(e.target.value)} placeholder="pm@company.com" />
            </div>

            <div style={{ marginTop: 14, display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setOpen(false)}>취소</button>
              <button onClick={addProject}>저장</button>
            </div>

            <p style={{ marginTop: 10, color: "#666" }}>* 프로젝트 코드는 중복될 수 없습니다.</p>
          </div>
        </div>
      )}
    </div>
  );
}

/** 모달 스타일 */
const overlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.35)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
  zIndex: 1000,
};

const modal: React.CSSProperties = {
  width: "min(720px, 100%)",
  background: "white",
  borderRadius: 10,
  padding: 16,
  boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
};
