export type VisualBlock =
  | {
      type: "coordinate_plane";
      title: string;
      points: { label: string; x: number; y: number }[];
      lines?: { from: string; to: string; label?: string }[];
      showGrid?: boolean;
      explanation?: string;
    }
  | {
      type: "scratch_steps";
      title: string;
      steps: {
        label: string;
        formula?: string;
        explanation: string;
      }[];
    }
  | {
      type: "formula_card";
      title: string;
      formula: string;
      variables: { symbol: string; meaning: string }[];
    }
  | {
      type: "table";
      title: string;
      columns: string[];
      rows: string[][];
    };
