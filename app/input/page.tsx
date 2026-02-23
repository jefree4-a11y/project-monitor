"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

/* ===================== 타입 ===================== */

type Profile = {
  email: string | null;
  full_name: string | null;
  approved: boolean;
};

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

type OwnerMode = "B_ONE_ROW" | "A_MULTI_ROW";
type RoleKey = "pm" | "design" | "mech" | "control" | "safety";
type OwnerRow = Record<RoleKey, string>;
const emptyOwnerRow: OwnerRow = { pm: "", design: "", mech: "", control: "", safety: "" };

type Update = {
  id: string | null; // stage_updates.id(UUID)
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

function addDaysISO(base: string, days: number) {
  const d = new Date(`${base}T00:00:00`);
  d.setDate(d.getDate() + days);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
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

/* ===================== 컴포넌트 ===================== */

export default function InputPage() {
  // ✅ 로그인 사용자 표시용
  const [email, setEmail] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  // 데이터
  const [projects, setProjects] = useState<Project[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [projectId, setProjectId] = useState<string>("");

  // URL에서 받은 projectId (대시보드/조회화면에서 진입)
  const [urlProjectId, setUrlProjectId] = useState<string>("");

  // stage_id -> Update row
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

  // 로그아웃 처리중 표시(중복 클릭 방지)
  const [loggingOut, setLoggingOut] = useState(false);

  // ✅ 담당자 입력 상태(A/B)
  const [ownerMode, setOwnerMode] = useState<OwnerMode>("B_ONE_ROW");
  const [ownerOne, setOwnerOne] = useState<OwnerRow>({ ...emptyOwnerRow });
  const [ownerRows, setOwnerRows] = useState<OwnerRow[]>(Array.from({ length: 5 }, () => ({ ...emptyOwnerRow })));

  const ownerCurrentRows = useMemo(
    () => (ownerMode === "B_ONE_ROW" ? [ownerOne] : ownerRows),
    [ownerMode, ownerOne, ownerRows]
  );

  // 공통 TD 스타일(정렬 깨짐 방지)
  const tdCenter: React.CSSProperties = { verticalAlign: "middle", textAlign: "center" };
  const tdTop: React.CSSProperties = { verticalAlign: "top" };

  const selected = useMemo(() => projects.find((p) => p.id === projectId), [projects, projectId]);

  const stagesSorted = useMemo(() => {
    const list = [...stages];
    list.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    return list;
  }, [stages]);

  // ✅ 담당자 입력 저장에 사용할 대표 stage_id (가장 첫 단계)
  const ownerStageId = useMemo(() => {
    if (!stagesSorted.length) return "";
    return stagesSorted[0].id;
  }, [stagesSorted]);

  /* ===================== Auth ===================== */

  // ✅ 로그아웃: /dashboard 로 이동
  async function handleLogout() {
    try {
      setLoggingOut(true);
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error("signOut error:", error);
        alert("로그아웃 실패: " + error.message);
        return;
      }
      window.location.href = "/dashboard";
    } finally {
      setLoggingOut(false);
    }
  }

  // ✅ 0) 로그인 사용자 정보 로드 (없으면 /login?redirectTo=... 로 보냄)
  useEffect(() => {
    const run = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error) console.error("getUser error:", error);

      const user = data.user;
      setEmail(user?.email ?? null);

      // ✅ 로그인 안 되어 있으면 로그인 페이지로 (원래 가려던 곳 포함)
      if (!user) {
        setAuthChecked(true);
        const here = window.location.pathname + window.location.search; // /input?projectId=...
        window.location.href = `/login?redirectTo=${encodeURIComponent(here)}`;
        return;
      }

      const { data: p, error: pErr } = await supabase
        .from("profiles")
        .select("email, full_name, approved")
        .eq("id", user.id)
        .single();

      if (pErr) {
        console.warn("profiles select error:", pErr);
        setProfile(null);
      } else {
        setProfile((p as Profile) ?? null);
      }

      setAuthChecked(true);
    };

    run();
  }, []);

  /* ===================== Data Load ===================== */

  // 1) URL에서 projectId 읽기
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("projectId") || "";
    setUrlProjectId(id);
  }, []);

  // 2) 프로젝트 목록 갱신
  async function refreshProjects(selectId?: string) {
    const p = await supabase
      .from("projects")
      .select("id, project_code, name, customer, install_location, order_date, due_date, status, pm_email")
      .order("project_code");

    if (p.error) {
      console.error("projects error:", p.error);
      alert("projects error: " + p.error.message);
      return;
    }

    const list = (p.data ?? []) as Project[];
    setProjects(list);

    // 우선순위: selectId > urlProjectId > 기존 projectId 유지 > 첫번째
    const nextId = selectId || (urlProjectId && list.some((x) => x.id === urlProjectId) ? urlProjectId : "") || projectId;

    if (nextId && list.some((x) => x.id === nextId)) {
      setProjectId(nextId);
      return;
    }

    if (list.length > 0) setProjectId(list[0].id);
  }

  // 3) 단계 목록 + 프로젝트 목록 로딩
  useEffect(() => {
    (async () => {
      await refreshProjects(urlProjectId || undefined);

      const s = await supabase.from("stages").select("id, name, sort_order").order("sort_order");

      if (s.error) {
        console.error("stages error:", s.error);
        alert("stages error: " + s.error.message);
        return;
      }

      setStages((s.data ?? []) as Stage[]);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlProjectId]);

  // 4) 프로젝트 선택 시 stage_updates 불러오기
  useEffect(() => {
    if (!projectId || stagesSorted.length === 0) return;

    (async () => {
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

      if (u.error) {
        console.error("stage_updates error:", u.error);
        alert("stage_updates error: " + u.error.message);
        return;
      }

      // 기본 틀 생성
      const base: Record<string, Update> = {};
      for (const st of stagesSorted) {
        base[st.id] = buildBaseRow(projectId, st.id);
      }

      for (const item of (u.data ?? []) as any[]) {
        const stId = item.stage_id as string;
        if (!base[stId]) base[stId] = buildBaseRow(projectId, stId);
        base[stId] = { ...base[stId], ...item, id: item.id ?? null };
      }

      setRows(base);

      // ✅ 대표 stage(ownerStageId)의 저장값으로 담당자 입력 초기화
      const ownerRow = ownerStageId ? base[ownerStageId] : null;
      if (ownerRow) {
        const matrix = ownerRow.owner_matrix;
        if (Array.isArray(matrix) && matrix.length > 0) {
          setOwnerMode("A_MULTI_ROW");
          setOwnerRows(
            matrix.map((r: any) => ({
              pm: r?.pm ?? "",
              design: r?.design ?? "",
              mech: r?.mech ?? "",
              control: r?.control ?? "",
              safety: r?.safety ?? "",
            }))
          );
        } else {
          setOwnerMode("B_ONE_ROW");
          setOwnerOne({
            pm: (ownerRow.owner_pm ?? "") as string,
            design: (ownerRow.owner_design ?? "") as string,
            mech: (ownerRow.owner_mech ?? "") as string,
            control: (ownerRow.owner_control ?? "") as string,
            safety: (ownerRow.owner_safety ?? "") as string,
          });
        }
      } else {
        setOwnerMode("B_ONE_ROW");
        setOwnerOne({ ...emptyOwnerRow });
        setOwnerRows(Array.from({ length: 5 }, () => ({ ...emptyOwnerRow })));
      }
    })();
  }, [projectId, stagesSorted, ownerStageId]);

  /* ===================== Handlers ===================== */

  function setField(stageId: string, key: keyof Update, value: any) {
    setRows((prev) => ({
      ...prev,
      [stageId]: { ...prev[stageId], [key]: value },
    }));
  }

  // ✅ 첫 단계 계획일 변경 시 → 2~5단계 자동 설정
  function onChangePlanDate(stageId: string, v: string | null) {
    setRows((prev) => {
      const next = { ...prev };
      if (!next[stageId]) return prev;

      next[stageId] = { ...next[stageId], plan_date: v };

      const changedStage = stagesSorted.find((s) => s.id === stageId);
      const isFirst = (changedStage?.sort_order ?? 999999) === (stagesSorted[0]?.sort_order ?? 1);
      if (!isFirst) return next;

      const offsets = [7, 10, 12, 14];
      const nextStages = stagesSorted.slice(1, 5); // 2~5단계
      for (let i = 0; i < nextStages.length; i++) {
        const st = nextStages[i];
        if (!next[st.id]) continue;
        next[st.id] = { ...next[st.id], plan_date: v ? addDaysISO(v, offsets[i] ?? 0) : null };
      }

      return next;
    });
  }

  // ✅ 담당자 입력 핸들러
  const updateOwnerCell = (rIdx: number, key: RoleKey, value: string) => {
    if (ownerMode === "B_ONE_ROW") {
      setOwnerOne((prev) => ({ ...prev, [key]: value }));
      return;
    }
    setOwnerRows((prev) => {
      const next = [...prev];
      next[rIdx] = { ...next[rIdx], [key]: value };
      return next;
    });
  };
  const addOwnerRow = () => setOwnerRows((prev) => [...prev, { ...emptyOwnerRow }]);
  const removeOwnerRow = (rIdx: number) => setOwnerRows((prev) => prev.filter((_, i) => i !== rIdx));

  // ✅ 담당자 입력 상태를 rows[ownerStageId]에 반영
  function applyOwnerBoxToRows(current: Record<string, Update>) {
    if (!ownerStageId) return current;
    const next = { ...current };
    const target = next[ownerStageId];
    if (!target) return current;

    if (ownerMode === "B_ONE_ROW") {
      next[ownerStageId] = {
        ...target,
        owner_pm: ownerOne.pm || null,
        owner_design: ownerOne.design || null,
        owner_mech: ownerOne.mech || null,
        owner_control: ownerOne.control || null,
        owner_safety: ownerOne.safety || null,
        owner_matrix: null,
      };
    } else {
      const m = ownerRows;
      next[ownerStageId] = {
        ...target,
        owner_matrix: m,
        owner_pm: m[0]?.pm || null,
        owner_design: m[0]?.design || null,
        owner_mech: m[0]?.mech || null,
        owner_control: m[0]?.control || null,
        owner_safety: m[0]?.safety || null,
      };
    }
    return next;
  }

  // ✅ 단계 입력값 저장 (id(UUID) 기준 insert/update)
  async function saveAll() {
    if (!projectId) return alert("프로젝트를 먼저 선택하세요.");
    if (!stagesSorted.length) return alert("단계(stages)가 없습니다.");

    const mergedRows = applyOwnerBoxToRows(rows);
    const nextRows: Record<string, Update> = { ...mergedRows };

    for (const st of stagesSorted) {
      const r = mergedRows[st.id];
      if (!r) continue;

      const payload: any = {
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

        owner_pm: r.owner_pm ?? null,
        owner_design: r.owner_design ?? null,
        owner_mech: r.owner_mech ?? null,
        owner_control: r.owner_control ?? null,
        owner_safety: r.owner_safety ?? null,
        owner_matrix: r.owner_matrix ?? null,
      };

      if (r.id) {
        const { error } = await supabase.from("stage_updates").update(payload).eq("id", r.id);
        if (error) return alert(`저장 실패(stage ${st.id}): ${error.message}`);
      } else {
        const { data, error } = await supabase.from("stage_updates").insert([payload]).select("id").single();
        if (error) return alert(`저장 실패(stage ${st.id}): ${error.message}`);
        nextRows[st.id] = { ...nextRows[st.id], id: (data as any)?.id ?? null };
      }
    }

    setRows(nextRows);
    alert("저장 완료!");
  }

  // ✅ 프로젝트 추가
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

    setNewCode("");
    setNewName("");
    setNewCustomer("");
    setNewInstallLocation("");
    setNewOrderDate("");
    setNewDueDate("");
    setNewStatus("진행");
    setNewPmEmail("");
    setOpen(false);

    await refreshProjects((data as any).id);
    alert("프로젝트가 추가되었습니다.");
  }

  // ✅ 수정 모달 열 때 자동으로 값 채우기
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

  // ✅ 프로젝트 수정 저장
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

  /* ===================== Render ===================== */

  if (!authChecked) return <div style={{ padding: 16 }}>로그인 확인중...</div>;

  return (
    <div style={{ padding: 16, height: "100vh", overflowY: "auto" }}>
      {/* ===== 상단 헤더 ===== */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <h2 style={{ margin: 0 }}>프로젝트 입력</h2>

        {/* 오른쪽 영역: 사용자정보 + 버튼 */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
          <div
            style={{
              fontSize: 13,
              opacity: 0.85,
              whiteSpace: "nowrap",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span>
              로그인: <b>{profile?.full_name ?? profile?.email ?? email ?? "알 수 없음"}</b>
              {"  |  "}
              승인: <b>{profile ? (profile.approved ? "승인됨" : "미승인") : "-"}</b>
            </span>

            <button
              onClick={handleLogout}
              disabled={loggingOut}
              style={{
                padding: "3px 10px",
                border: "1px solid #ccc",
                borderRadius: 4,
                background: loggingOut ? "#eee" : "#f5f5f5",
                cursor: loggingOut ? "not-allowed" : "pointer",
              }}
              title="로그아웃"
            >
              {loggingOut ? "로그아웃..." : "로그아웃"}
            </button>
          </div>

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
      </div>

      {/* ===== 프로젝트 선택 ===== */}
      <div style={{ marginTop: 12, marginBottom: 12 }}>
        <label>프로젝트 선택: </label>
        <select value={projectId} onChange={(e) => setProjectId(e.target.value)} style={{ marginLeft: 8 }}>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.project_code} - {p.name}
            </option>
          ))}
        </select>

        {/* 선택 프로젝트 정보 + 담당자 입력 */}
        {selected && (
          <div
            style={{
              marginTop: 10,
              padding: 10,
              border: "1px solid #ddd",
              borderRadius: 6,
              display: "grid",
              gridTemplateColumns: "1fr 560px",
              gap: 16,
              alignItems: "start",
            }}
          >
            {/* 왼쪽: 프로젝트 정보 */}
            <div>
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

            {/* 오른쪽: 담당자 입력 */}
            <div style={{ display: "flex", justifyContent: "center" }}>
              <div style={{ width: 520 }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "center", marginBottom: 8 }}>
                  <b style={{ fontSize: 13 }}>담당자 입력</b>

                  <label style={radioLabel}>
                    <input
                      type="radio"
                      name="ownerMode"
                      checked={ownerMode === "B_ONE_ROW"}
                      onChange={() => setOwnerMode("B_ONE_ROW")}
                    />
                    B(1행)
                  </label>

                  <label style={radioLabel}>
                    <input
                      type="radio"
                      name="ownerMode"
                      checked={ownerMode === "A_MULTI_ROW"}
                      onChange={() => setOwnerMode("A_MULTI_ROW")}
                    />
                    A(여러줄)
                  </label>

                  {ownerMode === "A_MULTI_ROW" && (
                    <button type="button" onClick={addOwnerRow} style={btnStyle}>
                      + 행 추가
                    </button>
                  )}
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
                        {ownerMode === "A_MULTI_ROW" ? <th style={thStyle}></th> : null}
                      </tr>
                    </thead>

                    <tbody>
                      {ownerCurrentRows.map((row, rIdx) => (
                        <tr key={rIdx}>
                          {(["pm", "design", "mech", "control", "safety"] as RoleKey[]).map((k) => (
                            <td key={k} style={ownerTdStyle}>
                              <input
                                value={row[k]}
                                onChange={(e) => updateOwnerCell(rIdx, k, e.target.value)}
                                style={ownerInputStyle}
                              />
                            </td>
                          ))}

                          {ownerMode === "A_MULTI_ROW" ? (
                            <td style={{ ...ownerTdStyle, width: 44 }}>
                              <button type="button" onClick={() => removeOwnerRow(rIdx)} style={iconBtnStyle}>
                                ✕
                              </button>
                            </td>
                          ) : null}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div style={{ marginTop: 6, fontSize: 12, color: "#64748b", textAlign: "center" }}></div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ===== 단계 입력 테이블 ===== */}
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
          {stagesSorted.map((st) => (
            <tr key={st.id}>
              {/* ✅ 여기: "sort_order + name" → "id + name" */}
              <td style={{ whiteSpace: "nowrap" }}>
                {st.id}. {st.name}
              </td>

              <td style={tdCenter}>
                <input
                  style={{ width: 70, textAlign: "center" }}
                  value={rows[st.id]?.assignee ?? ""}
                  onChange={(e) => setField(st.id, "assignee", e.target.value)}
                />
              </td>

              <td style={tdCenter}>
                <input
                  type="date"
                  value={rows[st.id]?.plan_date ?? ""}
                  onChange={(e) => onChangePlanDate(st.id, e.target.value || null)}
                />
              </td>

              <td style={tdCenter}>
                <input
                  type="date"
                  value={rows[st.id]?.actual_date ?? ""}
                  onChange={(e) => setField(st.id, "actual_date", e.target.value || null)}
                />
              </td>

              <td style={tdCenter}>
                <input
                  type="date"
                  value={rows[st.id]?.approve_date ?? ""}
                  onChange={(e) => setField(st.id, "approve_date", e.target.value || null)}
                />
              </td>

              <td style={tdTop}>
                {/* ✅ 여기: sort_order(7/8) 조건 → id("7"/"8") 조건 */}
                {st.id === "7" ? (
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
                          style={{ width: 140 }}
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

              <td style={tdTop}>
                <textarea
                  value={rows[st.id]?.memo ?? ""}
                  onChange={(e) => {
                    setField(st.id, "memo", e.target.value);
                    e.currentTarget.style.height = "auto";
                    e.currentTarget.style.height = e.currentTarget.scrollHeight + "px";
                  }}
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
              <input value={newInstallLocation} onChange={(e) => setNewInstallLocation(e.target.value)} />

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

              <label>PM</label>
              <input value={newPmEmail} onChange={(e) => setNewPmEmail(e.target.value)} />
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

              <label>PM</label>
              <input value={editPmEmail} onChange={(e) => setEditPmEmail(e.target.value)} />
            </div>

            <div style={{ marginTop: 14, display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setEditOpen(false)}>취소</button>
              <button onClick={updateProject}>저장</button>
            </div>

            <p style={{ marginTop: 10, color: "#666" }}>* 프로젝트 코드는 수정 불가로 두었습니다.</p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ===================== 스타일 ===================== */

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

const radioLabel: React.CSSProperties = {
  display: "flex",
  gap: 6,
  alignItems: "center",
  fontSize: 12,
};

const btnStyle: React.CSSProperties = {
  border: "1px solid #cbd5e1",
  background: "white",
  padding: "4px 8px",
  borderRadius: 6,
  fontSize: 12,
  cursor: "pointer",
};

const iconBtnStyle: React.CSSProperties = {
  width: 32,
  height: 26,
  border: "1px solid #cbd5e1",
  background: "white",
  borderRadius: 6,
  cursor: "pointer",
};

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

const ownerInputStyle: React.CSSProperties = {
  width: "100%",
  height: 26,
  border: "1px solid #cbd5e1",
  borderRadius: 4,
  padding: "0 8px",
  fontSize: 12,
  background: "white",
};