export type FileWithRange = {
  path: string;
  content: string;
  range: {
    start: number;
    end: number;
  };
};

export type FileWithUpdatedContent = {
  path: string;
  updatedContent: string;
};
