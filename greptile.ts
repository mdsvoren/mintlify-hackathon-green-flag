export const fetchFeatureFlags = async (repository: string, branch: string): Promise<Array<{ filepath: string; linestart: number; lineend: number }>> => {
    const greptile_api_key = process.env.GREPTILE_API_KEY;
    const github_token = process.env.GITHUB_TOKEN;

    if (!greptile_api_key || !github_token) {
        throw new Error('Missing required environment variables');
    }

    try {
        const response = await fetch('https://api.greptile.com/v2/search', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${greptile_api_key}`,
                'X-Github-Token': github_token,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                query: "Give me all of the files and lines that contain feature flags",
                repositories: [{
                    remote: "github",
                    branch,
                    repository
                }],
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const featureFlagsData = await response.json();
        return featureFlagsData.map(({ filepath, linestart, lineend }: { filepath: string; linestart: number; lineend: number }) => ({
            filepath,
            linestart,
            lineend
        }));
    } catch (error) {
        console.error('Error fetching feature flags:', error);
        throw error;
    }
}