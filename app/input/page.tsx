"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Project = { id: string; project_code: string; name: string };
type Stage = { id: string; name: string; sort_order: number };

type Update = {
  project_id: string;
  stage_id: string;
  plan_date: string | null;
  actual_date: string | null;
  approve_date: string | null;
  meeting_type: string;
  memo: string | null;
};

export default function InputPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [projectId, setProjectId] = useState<string>("");
  const [rows, setRows] = useState<Record<string, Update>>({}); // stage_id -> row

  // 1) 프로젝트/단계 목록 가져오기
  useEffect(() => {
    (async () => {
      const p = await supabase.from("projects").select("id, project_code, name").order("project_code");
      const s = await supabase.from("stages").select("id, name, sort_order").order("sort_order");

      setProjects(p.data ?? []);
      setStages(s.data ?? []);

      if ((p.data ?? []).length > 0) {
        setProjectId(p.data![0].id);
      }
    })();
  }, []);

  // 2) 특정 프로젝트 선택하면 그 프로젝트의 stage_updates 불러오기
  useEffect(() => {
    if (!projectId || stages.length === 0) return;

    (async () => {
      const u = await supabase
        .from("stage_updates")
        .select("project_id, stage_id, plan_date, actual_date, approve_date, meeting_type, memo")
        .eq("project_id", projectId);

      // 단계 전체 기본 틀을 먼저 만든 후, DB에 있는 값으로 덮어쓰기
      const base: Record<string, Update> = {};
      for (const st of stages) {
        base[st.id] = {
          project_id: projectId,
          stage_id: st.id,
          plan_date: null,
          actual_date: null,
          approve_date: null,
          meeting_type: "해당없음",
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

  // 3) 저장: upsert (있으면 업데이트, 없으면 생성)
  async function saveAll() {
    const payload = Object.values(rows).map((r) => ({
      project_id: projectId,
      stage_id: r.stage_id,
      plan_date: r.plan_date || null,
      actual_date: r.actual_date || null,
      approve_date: r.approve_date || null,
      meeting_type: r.meeting_type || "해당없음",
      memo: r.memo || null,
      updated_at: new Date().toISOString(),
    }));

    const { error } = await supabase
      .from("stage_updates")
      .upsert(payload, { onConflict: "project_id,stage_id" });

    if (error) return alert(error.message);
    alert("저장 완료!");
  }

  return (
    <div style={{ padding: 16 }}>
      <h2>입력화면 (PM용)</h2>

      <div style={{ marginBottom: 12 }}>
        <label>프로젝트 선택: </label>
        <select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.project_code} - {p.name}
            </option>
          ))}
        </select>

        <button onClick={saveAll} style={{ marginLeft: 12 }}>
          전체 저장
        </button>
      </div>

      <table border={1} cellPadding={6} style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr>
            <th>단계</th>
            <th>계획일</th>
            <th>실적일</th>
            <th>승인일</th>
            <th>회의(6/7)</th>
            <th>메모</th>
          </tr>
        </thead>
        <tbody>
          {stages.map((st) => (
            <tr key={st.id}>
              <td>{st.id}. {st.name}</td>

              <td>
                <input
                  type="date"
                  value={rows[st.id]?.plan_date ?? ""}
                  onChange={(e) => setField(st.id, "plan_date", e.target.value || null)}
                />
              </td>

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

              <td>
                {(st.id === "6" || st.id === "7") ? (
                  <select
                    value={rows[st.id]?.meeting_type ?? "해당없음"}
                    onChange={(e) => setField(st.id, "meeting_type", e.target.value)}
                  >
                    <option>해당없음</option>
                    <option>회의</option>
                    <option>서면</option>
                  </select>
                ) : (
                  "-"
                )}
              </td>

              <td>
                <input
                  style={{ width: "98%" }}
                  value={rows[st.id]?.memo ?? ""}
                  onChange={(e) => setField(st.id, "memo", e.target.value)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ marginTop: 12 }}>
        <a href="/dashboard">대시보드로 이동</a>
      </div>
    </div>
  );
}
