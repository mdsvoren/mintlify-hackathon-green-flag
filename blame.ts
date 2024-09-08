import { Octokit } from "octokit";

type BlameRange = {
  commit: {
    authoredDate: String;
  };
  startingLine: Number;
  endingLine: Number;
  age: Number;
};

export async function getSnippetChangeDate({
  client,
  owner,
  repo,
  ref,
  filePath,
  startLine,
  endLine,
}: {
  client: Octokit;
  owner: String;
  repo: String;
  ref: String;
  filePath: String;
  startLine: Number;
  endLine: Number;
}) {
  const result = (await client.graphql(
    `{
    repository(name:"${repo}", owner:"${owner}") {
      # branch name
      ref(qualifiedName: "${ref}") {
        target {
          # cast Target to a Commit
          ... on Commit {
            # full repo-relative path to blame file
            blame(path:"${filePath}") {
              ranges {
                commit {
                  authoredDate
                }
                startingLine
                endingLine
                age
              }
            }
          }
        }
      }
    }
  }`,
  )) as any;

  const changeDates = result.repository.ref.target.blame.ranges
    .filter(
      (blameRange: BlameRange) =>
        (blameRange.startingLine <= startLine &&
          blameRange.endingLine >= startLine) ||
        (blameRange.startingLine <= endLine &&
          blameRange.endingLine >= endLine),
    )
    .map((blameRange: BlameRange) => blameRange.commit.authoredDate)
    .sort();

  if (changeDates.length === 0) {
    throw new Error("No change dates found");
  }

  return changeDates[changeDates.length - 1];
}
