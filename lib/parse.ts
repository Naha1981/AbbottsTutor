/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
/* tslint:disable */

export const parseJSON = (str: string): any => {
  try {
    // Attempt to find JSON within backticks (common for Gemini markdown JSON)
    const match = str.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (match && match[1]) {
      return JSON.parse(match[1]);
    }
    // Fallback for non-backticked JSON or if regex fails
    const start = str.indexOf('{');
    const end = str.lastIndexOf('}') + 1;
    if (start === -1 || end === 0) { // Check if '{' or '}' were found
        // Try parsing as array if object fails
        const arrayStart = str.indexOf('[');
        const arrayEnd = str.lastIndexOf(']') + 1;
        if (arrayStart !== -1 && arrayEnd !== 0) {
            return JSON.parse(str.substring(arrayStart, arrayEnd));
        }
        console.warn("parseJSON: Could not find valid JSON object or array delimiters.");
        throw new Error("Invalid JSON string: No object or array delimiters found.");
    }
    return JSON.parse(str.substring(start, end));
  } catch (error) {
    console.error("Failed to parse JSON string:", str, error);
    // Return a more informative error or a specific structure indicating failure
    throw new Error(`Failed to parse JSON: ${error.message}. Original string: ${str.substring(0,100)}...`);
  }
};


export const parseJsonResponse = (text: string): any => {
  let jsonStr = text.trim();
  const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
  const match = jsonStr.match(fenceRegex);
  if (match && match[2]) {
    jsonStr = match[2].trim(); // Trim the extracted content itself
  }

  // Removed the following line as it caused issues:
  // jsonStr = jsonStr.replace(/(?<!\\)\n/g, '\\n');
  // This line was incorrectly escaping newlines that were part of the JSON
  // structure (i.e., valid whitespace) rather than solely targeting newlines
  // *within* string literals. Standard JSON.parse handles valid whitespace.

  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    // Log the string that failed parsing for better debugging.
    console.error("Failed to parse JSON response:", e, "Original text (after fence removal and trim):", jsonStr.substring(0, 500) + (jsonStr.length > 500 ? "..." : ""));
    throw new Error(`Failed to parse JSON content: ${e.message}. Content (snippet after cleaning): ${jsonStr.substring(0, 100)}...`);
  }
};


export const parseHTML = (str: string, opener: string, closer: string): string => {
  // Look for opener (e.g., ```html) and closer (```)
  const openerRegex = new RegExp(opener.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\n?');
  const match = str.match(openerRegex);
  
  let startIndex = -1;
  if (match && match.index !== undefined) {
    startIndex = match.index + match[0].length;
  } else {
    // Fallback to just finding <!DOCTYPE html> if opener is not found
    startIndex = str.indexOf('<!DOCTYPE html>');
  }

  if (startIndex === -1) {
    console.warn("parseHTML: Could not find a valid starting point for HTML content (<!DOCTYPE html> or opener).");
    // Try to return the string if it looks like HTML anyway, or throw an error
    if (str.trim().toLowerCase().includes("<html")) return str; // Basic check
    return "<!-- Error: Could not parse HTML content. No valid start found. -->";
  }

  const endIndex = str.lastIndexOf(closer);

  if (endIndex === -1 || endIndex <= startIndex) {
     console.warn(`parseHTML: Could not find closer "${closer}" or it appeared before the opener.`);
     // If no closer, assume the rest of the string from startIndex is HTML
     return str.substring(startIndex);
  }
  
  return str.substring(startIndex, endIndex).trim();
};