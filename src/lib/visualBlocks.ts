export type VisualBlock =
  | {
      type: "source_evidence";
      title: string;
      year?: string;
      questionLabel?: string;
      pageNumber?: number;
      status: string;
      verified: boolean;
    }
  | {
      type: "pdf_image_preview";
      title: string;
      imageUrl: string;
      sourceId?: string;
      storagePath?: string;
      pageNumber?: number;
      crop?: { x: number; y: number; width: number; height: number } | null;
      caption?: string;
    }
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
      type: "reaction_diagram";
      title: string;
      equation: string;
      caption?: string;
    }
  | {
      type: "comparison_bars";
      title: string;
      items: { label: string; value: number; displayValue?: string }[];
      caption?: string;
    }
  | {
      type: "process_flow";
      title: string;
      steps: string[];
      caption?: string;
    }
  | {
      type: "table";
      title: string;
      columns: string[];
      rows: string[][];
    };
