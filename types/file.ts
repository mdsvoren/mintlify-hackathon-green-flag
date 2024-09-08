export type FileWithRangeAndDescription = {
  path: string;
  content: string;
  range: {
    start: number;
    end: number;
  };
  description?: string;
};

export type FileWithUpdatedContent = {
  path: string;
  updatedContent: string;
};
