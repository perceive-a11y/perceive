/**
 * Fetch theme files from Shopify's Admin API via GraphQL.
 *
 * Uses the `read_themes` scope to access theme templates, layouts,
 * snippets, and asset CSS files for scanning.
 */

import type { AdminApiContext } from "@shopify/shopify-app-remix/server";
import type { ThemeFile } from "./scanner.server";

const THEME_FILES_QUERY = `#graphql
  query getThemeFiles($themeId: ID!, $filenames: [String!]!) {
    theme(id: $themeId) {
      files(filenames: $filenames, first: 250) {
        nodes {
          filename
          body {
            ... on OnlineStoreThemeFileBodyText {
              content
            }
          }
        }
      }
    }
  }
`;

const THEMES_QUERY = `#graphql
  query getThemes {
    themes(first: 10) {
      nodes {
        id
        name
        role
      }
    }
  }
`;

const THEME_FILE_LIST_QUERY = `#graphql
  query getThemeFileList($themeId: ID!) {
    theme(id: $themeId) {
      files(first: 250) {
        nodes {
          filename
        }
      }
    }
  }
`;

export interface Theme {
  id: string;
  name: string;
  role: string;
}

/**
 * Get all themes for the shop (up to 10).
 */
export async function getThemes(
  admin: AdminApiContext["admin"]
): Promise<Theme[]> {
  const response = await admin.graphql(THEMES_QUERY);
  const data = await response.json();
  return data.data?.themes?.nodes ?? [];
}

/**
 * Get the active (published) theme for a shop.
 */
export async function getActiveTheme(
  admin: AdminApiContext["admin"]
): Promise<Theme | null> {
  const themes = await getThemes(admin);
  return themes.find((t: Theme) => t.role === "MAIN") ?? null;
}

/**
 * Fetch all scannable files from a theme.
 *
 * Returns Liquid templates, HTML layouts, snippets, and CSS assets.
 * Skips JSON config files, images, and other binary assets.
 */
export async function fetchThemeFiles(
  admin: AdminApiContext["admin"],
  themeId: string
): Promise<ThemeFile[]> {
  // First, get the list of all filenames
  const listResponse = await admin.graphql(THEME_FILE_LIST_QUERY, {
    variables: { themeId },
  });
  const listData = await listResponse.json();
  const allFilenames: string[] =
    listData.data?.theme?.files?.nodes?.map(
      (n: { filename: string }) => n.filename
    ) ?? [];

  // Filter to scannable file types
  const scannableFiles = allFilenames.filter(
    (f) =>
      f.endsWith(".liquid") || f.endsWith(".html") || f.endsWith(".css")
  );

  if (scannableFiles.length === 0) {
    return [];
  }

  // Fetch file contents in batches (API limit)
  const batchSize = 50;
  const results: ThemeFile[] = [];

  for (let i = 0; i < scannableFiles.length; i += batchSize) {
    const batch = scannableFiles.slice(i, i + batchSize);
    const response = await admin.graphql(THEME_FILES_QUERY, {
      variables: { themeId, filenames: batch },
    });
    const data = await response.json();
    const files = data.data?.theme?.files?.nodes ?? [];

    for (const file of files) {
      if (file.body?.content) {
        results.push({
          filename: file.filename,
          content: file.body.content,
        });
      }
    }
  }

  return results;
}
