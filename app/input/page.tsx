"use client";

import React, { useEffect, useState } from "react";
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

function addDaysISO(base: string, days: number) {
  const d = new Date(`${base}T00:00:00`);
  d.setDate(d.getDate() + days);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function InputPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [projectId, setProjectId] = useState<string>("");
  const [urlProjectId, setUrlProjectId] = useState<string>("");

  // stage_id -> row
  const [rows, setRows] = useState<Record<string, Update>>({});

  // ---- 프로젝트 추가 모달 상태 ----
  const [open, setOpen] = useState(false);

  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [newCustomer, setNewCustomer] = useState("");
  const [newInstallLocation, setNewInstallLocation] = useState("");
  const [newOrderDate, setNewOrderDate] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [newStatus, setNewStatus] = useState<"진행" | "보류" | "완료">("진행");
  const [newPmEmail, setNewPmEmail] = useState("");

  // ---- 프로젝트 수정 모달 상태 ----
  const [editOpen, setEditOpen] = useState(false);

  const [editCode, setEditCode] = useState("");
  const [editName, setEditName] = useState("");
  const [editCustomer, setEditCustomer] = useState("");
  const [editInstallLocation, setEditInstallLocation] = useState("");
  const [editOrderDate, setEditOrderDate] = useState("");
  const [editDueDate, setEditDueDate] = useState("");
  const [editStatus, setEditStatus] = useState<"진행" | "보류" | "완료">("진행");
  const [editPmEmail, setEditPmEmail] = useState("");

  // 공통 TD 스타일(정렬 깨짐 방지)
  const tdCenter: React.CSSProperties = { verticalAlign: "middle", textAlign: "center" };
  const tdTop: React.CSSProperties = { verticalAlign: "top" };

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

  // 2-1) URL에서 projectId 읽기
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("projectId") || "";
    setUrlProjectId(id);
  }, []);

  // 2-2) 단계 목록 + 프로젝트 목록 로딩
  useEffect(() => {
    (async () => {
      await refreshProjects(urlProjectId || undefined);

      const s = await supabase.from("stages").select("id, name, sort_order").order("sort_order");
      setStages((s.data ?? []) as Stage[]);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlProjectId]);

  // 3) 프로젝트 선택 시 stage_updates 불러오기
  useEffect(() => {
    if (!projectId || stages.length === 0) return;

    (async () => {
      const u = await supabase
        .from("stage_updates")
        .select(
          `
          project_id, stage_id, assignee,
          plan_date, actual_date, approve_date,
          remark_design_work, remark_outsource_design,
          vendor_assembly, vendor_install, vendor_control, vendor_program,
          memo
        `
        )
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

  // ✅ 1번 계획일 변경 처리 (2~5 무조건 자동 덮어쓰기 + 2~5 수동금지)
  function onChangePlanDate(stageId: string, v: string | null) {
  setRows((prev) => {
    const next = { ...prev };

    // 현재 단계 저장
    next[stageId] = { ...next[stageId], plan_date: v };

    // ⭐ 1번 변경 시에만 2~5 자동계산
    if (stageId === "1") {
      if (v) {
        next["2"] = { ...next["2"], plan_date: addDaysISO(v, 7) };
        next["3"] = { ...next["3"], plan_date: addDaysISO(v, 10) };
        next["4"] = { ...next["4"], plan_date: addDaysISO(v, 12) };
        next["5"] = { ...next["5"], plan_date: addDaysISO(v, 14) };
      } else {
        next["2"] = { ...next["2"], plan_date: null };
        next["3"] = { ...next["3"], plan_date: null };
        next["4"] = { ...next["4"], plan_date: null };
        next["5"] = { ...next["5"], plan_date: null };
      }
    }

    return next;
  });
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

    const { error } = await supabase.from("stage_updates").upsert(payload, {
      onConflict: "project_id,stage_id",
    });

    if (error) return alert(error.message);
    alert("저장 완료!");
  }

  // 5) 프로젝트 추가
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

    await refreshProjects(data.id);
    alert("프로젝트가 추가되었습니다.");
  }

  const selected = projects.find((p) => p.id === projectId);

  // 수정 모달 열 때 자동으로 값 채우기(선택 변경 시도 반영)
  useEffect(() => {
    if (!selected) return;

    setEditCode(selected.project_code ?? "");
    setEditName(selected.name ?? "");
    setEditCustomer(selected.customer ?? "");
    setEditInstallLocation(selected.install_location ?? "");
    setEditOrderDate(selected.order_date ?? "");
    setEditDueDate(selected.due_date ?? "");
    setEditStatus((selected.status as any) ?? "진행");
    setEditPmEmail(selected.pm_email ?? "");
  }, [selected]);

  // 6) 프로젝트 수정 저장
  async function updateProject() {
    if (!selected) return alert("수정할 프로젝트를 먼저 선택하세요.");
    if (!editName.trim()) return alert("프로젝트명은 필수입니다.");

    const { error } = await supabase
      .from("projects")
      .update({
        name: editName.trim(),
        customer: editCustomer.trim() || null,
        install_location: editInstallLocation.trim() || null,
        order_date: editOrderDate || null,
        due_date: editDueDate || null,
        status: editStatus,
        pm_email: editPmEmail.trim() || null,
      })
      .eq("id", selected.id);

    if (error) return alert(error.message);

    setEditOpen(false);
    await refreshProjects(selected.id);
    alert("프로젝트 정보가 수정되었습니다.");
  }

  return (
    <div style={{ padding: 16, height: "100vh", overflowY: "auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <h2 style={{ margin: 0 }}>입력화면 (PM용)</h2>

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setOpen(true)}>+ 프로젝트 추가</button>
          <button onClick={() => setEditOpen(true)} disabled={!selected}>
            ✎ 프로젝트 수정
          </button>
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

        {/* 선택 프로젝트 정보 */}
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
            <th style={{ width: 120 }}>단계</th>
            <th style={{ width: 100 }}>담당자</th>
            <th style={{ width: 110 }}>계획일</th>
            <th style={{ width: 110 }}>실적일</th>
            <th style={{ width: 150 }}>승인일(품질관리팀)</th>
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

              {/* 담당자 */}
              <td>
                <input
                  style={{ width: 120 }}
                  value={rows[st.id]?.assignee ?? ""}
                  onChange={(e) => setField(st.id, "assignee", e.target.value)}
                  placeholder="담당자"
                />
              </td>

              {/* 계획일 */}
              <td style={tdCenter}>
                <input
                  type="date"
                  value={rows[st.id]?.plan_date ?? ""}
                  onChange={(e) => onChangePlanDate(st.id, e.target.value || null)}
                />
              </td>

              {/* 실적일 */}
              <td style={tdCenter}>
                <input
                  type="date"
                  value={rows[st.id]?.actual_date ?? ""}
                  onChange={(e) => setField(st.id, "actual_date", e.target.value || null)}
                />
              </td>

              {/* 승인일 */}
              <td style={tdCenter}>
                <input
                  type="date"
                  value={rows[st.id]?.approve_date ?? ""}
                  onChange={(e) => setField(st.id, "approve_date", e.target.value || null)}
                />
              </td>

              {/* 비고 */}
              <td style={tdTop}>
                {st.id === "7-1" ? (
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
              <td style={tdTop}>
                <textarea
                  value={rows[st.id]?.memo ?? ""}
                  onChange={(e) => {
                    setField(st.id, "memo", e.target.value);
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
              <input
                value={newInstallLocation}
                onChange={(e) => setNewInstallLocation(e.target.value)}
                placeholder="예: 둔포3공장"
              />

              <label>수주일자</label>
              <input type="date" value={newOrderDate} onChange={(e) => setNewOrderDate(e.target.value)} />

              <label>납기일</label>
              <input type="date" value={newDueDate} onChange={(e) => setNewDueDate(e.target.value)} />

              <label>상태</label>
              <select value={newStatus} onChange={(e) => setNewStatus(e.target.value as any)}>
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

      {/* ---- 프로젝트 수정 모달 ---- */}
      {editOpen && selected && (
        <div style={overlay}>
          <div style={modal}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              <h3 style={{ margin: 0 }}>프로젝트 수정</h3>
              <button onClick={() => setEditOpen(false)}>닫기</button>
            </div>

            <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "140px 1fr", gap: 10 }}>
              <label>프로젝트 코드</label>
              <input value={editCode} disabled />

              <label>프로젝트명*</label>
              <input value={editName} onChange={(e) => setEditName(e.target.value)} />

              <label>고객사</label>
              <input value={editCustomer} onChange={(e) => setEditCustomer(e.target.value)} />

              <label>설치위치</label>
              <input value={editInstallLocation} onChange={(e) => setEditInstallLocation(e.target.value)} />

              <label>수주일자</label>
              <input type="date" value={editOrderDate} onChange={(e) => setEditOrderDate(e.target.value)} />

              <label>납기일</label>
              <input type="date" value={editDueDate} onChange={(e) => setEditDueDate(e.target.value)} />

              <label>상태</label>
              <select value={editStatus} onChange={(e) => setEditStatus(e.target.value as any)}>
                <option value="진행">진행</option>
                <option value="보류">보류</option>
                <option value="완료">완료</option>
              </select>

              <label>PM 이메일</label>
              <input value={editPmEmail} onChange={(e) => setEditPmEmail(e.target.value)} />
            </div>

            <div style={{ marginTop: 14, display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setEditOpen(false)}>취소</button>
              <button onClick={updateProject}>저장</button>
            </div>

            <p style={{ marginTop: 10, color: "#666" }}>* 프로젝트 코드는 고유키로 쓰는 경우가 많아 수정 불가로 두었습니다.</p>
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
