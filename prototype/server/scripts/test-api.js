#!/usr/bin/env node

/**
 * Simple API test script for DP-1 Feed Operator API
 * Usage: node scripts/test-api.js [base-url] [api-secret]
 */

import { readFileSync } from 'fs';
import { randomUUID } from 'crypto';

// Parse command line arguments
const args = process.argv.slice(2);
const baseUrl = args[0] || 'http://localhost:8787';
const apiSecret = args[1] || process.env.API_SECRET;

console.log(`🧪 Testing DP-1 Feed Operator API at: ${baseUrl}`);

if (!apiSecret) {
  console.error('❌ API_SECRET not provided. Pass as argument or set environment variable.');
  process.exit(1);
}

// Test data without IDs or dpVersion (server will generate them)
const testPlaylist = {
  dpVersion: '0.9.0',
  title: 'My Amazing Test Playlist',
  defaults: {
    display: {
      scaling: 'fit',
      background: '#000000',
    },
    license: 'open',
    duration: 300,
  },
  items: [
    {
      title: 'My Amazing Test Artwork',
      source: 'https://example.com/test.html',
      duration: 300,
      license: 'open',
    },
  ],
};

// Store server-generated data for testing
let createdPlaylistId = null;
let createdPlaylistSlug = null;
let createdPlaylistGroupId = null;
let createdPlaylistGroupSlug = null;

// Helper function to make HTTP requests
async function makeRequest(method, path, body = null) {
  const url = `${baseUrl}${path}`;
  const headers = {
    'Content-Type': 'application/json',
  };

  // Add auth header for write operations
  if (method !== 'GET') {
    headers['Authorization'] = `Bearer ${apiSecret}`;
  }

  const options = {
    method,
    headers,
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(url, options);
    const text = await response.text();

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }

    return {
      status: response.status,
      ok: response.ok,
      data,
    };
  } catch (error) {
    return {
      status: 0,
      ok: false,
      error: error.message,
    };
  }
}

// Test functions
async function testListPlaylists() {
  console.log('\n📋 Testing GET /api/v1/playlists (list all playlists)...');
  const response = await makeRequest('GET', '/api/v1/playlists');

  if (response.ok) {
    console.log('✅ Playlists listed successfully');
    // Handle paginated result format
    const paginatedResult = response.data;
    if (paginatedResult && Array.isArray(paginatedResult.items)) {
      console.log(`   Count: ${paginatedResult.items.length}`);
      console.log(`   Has more: ${paginatedResult.hasMore || false}`);
      console.log(`   Cursor: ${paginatedResult.cursor ? 'Present' : 'None'}`);
      if (paginatedResult.items.length > 0) {
        console.log(`   First playlist ID: ${paginatedResult.items[0].id}`);
        if (paginatedResult.items[0].slug) {
          console.log(`   First playlist slug: ${paginatedResult.items[0].slug}`);
        }
      }
    } else {
      console.log('❌ Expected paginated result format with items array');
      return false;
    }
  } else {
    console.log(`❌ Failed: ${response.status} - ${JSON.stringify(response.data)}`);
  }

  return response.ok;
}

async function testPagination() {
  console.log('\n📄 Testing pagination with limit and cursor...');

  // Test with limit
  const limitResponse = await makeRequest('GET', '/api/v1/playlists?limit=1');

  if (limitResponse.ok) {
    const result = limitResponse.data;
    if (result.items && result.items.length <= 1) {
      console.log('✅ Limit parameter working correctly');

      // Test cursor if available
      if (result.cursor && result.hasMore) {
        const cursorResponse = await makeRequest(
          'GET',
          `/api/v1/playlists?limit=1&cursor=${encodeURIComponent(result.cursor)}`
        );
        if (cursorResponse.ok) {
          console.log('✅ Cursor pagination working correctly');
        } else {
          console.log('❌ Cursor pagination failed');
          return false;
        }
      } else {
        console.log('ℹ️  No cursor available (only one page of results)');
      }
    } else {
      console.log('❌ Limit parameter not working correctly');
      return false;
    }
  } else {
    console.log(`❌ Pagination test failed: ${limitResponse.status}`);
    return false;
  }

  return true;
}

async function testPlaylistGroupFiltering() {
  if (!createdPlaylistGroupId) {
    console.log('\n⚠️  Skipping filtering test - no playlist group ID available');
    return true;
  }

  console.log('\n🔍 Testing playlist filtering by playlist-group...');
  const response = await makeRequest(
    'GET',
    `/api/v1/playlists?playlist-group=${createdPlaylistGroupId}`
  );

  if (response.ok) {
    console.log('✅ Playlist group filtering working');
    const result = response.data;
    if (result && Array.isArray(result.items)) {
      console.log(`   Filtered playlists count: ${result.items.length}`);
    } else {
      console.log('❌ Expected paginated result format');
      return false;
    }
  } else {
    console.log(`❌ Failed: ${response.status} - ${JSON.stringify(response.data)}`);
  }

  return response.ok;
}

async function testCreatePlaylist() {
  console.log('\n📝 Testing POST /api/v1/playlists (server-side ID and slug generation)...');
  const response = await makeRequest('POST', '/api/v1/playlists', testPlaylist);

  if (response.ok) {
    console.log('✅ Playlist created successfully');
    console.log(`   ID: ${response.data.id}`);
    console.log(`   Slug: ${response.data.slug}`);
    console.log(`   Title: ${response.data.title}`);
    console.log(`   Created: ${response.data.created}`);
    console.log(`   Signature: ${response.data.signature ? 'Present' : 'Missing'}`);

    // Store server-generated data
    createdPlaylistId = response.data.id;
    createdPlaylistSlug = response.data.slug;

    // Validate UUID format
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(response.data.id)) {
      console.log('✅ Server-generated UUID format is valid');
    } else {
      console.log('❌ Server-generated UUID format is invalid');
      return false;
    }

    // Validate slug format
    if (response.data.slug && /^[a-zA-Z0-9-]+-\d{4}$/.test(response.data.slug)) {
      console.log('✅ Server-generated slug format is valid');
    } else {
      console.log('❌ Server-generated slug format is invalid or missing');
      return false;
    }

    // Validate playlist item IDs are also generated
    if (
      response.data.items &&
      response.data.items[0] &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        response.data.items[0].id
      )
    ) {
      console.log('✅ Playlist item UUID format is valid');
    } else {
      console.log('❌ Playlist item UUID format is invalid');
      return false;
    }
  } else {
    console.log(`❌ Failed: ${response.status} - ${JSON.stringify(response.data)}`);
  }

  return response.ok;
}

async function testGetPlaylistByUUID() {
  if (!createdPlaylistId) {
    console.log('\n⚠️  Skipping UUID test - no playlist ID available');
    return true;
  }

  console.log('\n📖 Testing GET /api/v1/playlists/{uuid} (access by UUID)...');
  const response = await makeRequest('GET', `/api/v1/playlists/${createdPlaylistId}`);

  if (response.ok) {
    console.log('✅ Playlist retrieved by UUID successfully');
    console.log(`   ID: ${response.data.id}`);
    console.log(`   Slug: ${response.data.slug}`);
    console.log(`   Created: ${response.data.created}`);
  } else {
    console.log(`❌ Failed: ${response.status} - ${JSON.stringify(response.data)}`);
  }

  return response.ok;
}

async function testGetPlaylistBySlug() {
  if (!createdPlaylistSlug) {
    console.log('\n⚠️  Skipping slug test - no slug available');
    return true;
  }

  console.log('\n📖 Testing GET /api/v1/playlists/{slug} (access by slug)...');
  const response = await makeRequest('GET', `/api/v1/playlists/${createdPlaylistSlug}`);

  if (response.ok) {
    console.log('✅ Playlist retrieved by slug successfully');
    console.log(`   ID: ${response.data.id}`);
    console.log(`   Slug: ${response.data.slug}`);

    // Verify we get the same playlist
    if (response.data.id === createdPlaylistId) {
      console.log('✅ Same playlist returned via slug and UUID');
    } else {
      console.log('❌ Different playlist returned via slug vs UUID');
      return false;
    }
  } else {
    console.log(`❌ Failed: ${response.status} - ${JSON.stringify(response.data)}`);
  }

  return response.ok;
}

async function testUpdatePlaylist() {
  if (!createdPlaylistId) {
    console.log('\n⚠️  Skipping update test - no playlist ID available');
    return true;
  }

  console.log('\n📝 Testing PUT /api/v1/playlists/{id} (slug regeneration and new item IDs)...');
  // remove the dpVersion from the testPlaylist
  const { dpVersion, ...rest } = testPlaylist;
  const updatedPlaylist = {
    ...rest,
    items: [
      {
        ...testPlaylist.items[0],
        title: 'Updated Amazing Digital Artwork',
      },
      {
        title: 'Second Test Artwork',
        source: 'https://example.com/test2.html',
        duration: 180,
        license: 'token',
      },
    ],
  };

  const response = await makeRequest(
    'PUT',
    `/api/v1/playlists/${createdPlaylistId}`,
    updatedPlaylist
  );

  if (response.ok) {
    console.log('✅ Playlist updated successfully');
    console.log(`   Items: ${response.data.items?.length || 0}`);
    console.log(`   New slug: ${response.data.slug}`);

    // Verify slug was not regenerated
    if (response.data.slug !== createdPlaylistSlug) {
      console.log('❌ Slug was regenerated after title change');
      return false;
    } else {
      console.log('✅ Slug was not regenerated after title change');
    }
  } else {
    console.log(`❌ Failed: ${response.status} - ${JSON.stringify(response.data)}`);
  }

  return response.ok;
}

async function testCreatePlaylistGroup() {
  console.log('\n📝 Testing POST /api/v1/playlist-groups (server-side ID and slug generation)...');

  // Ensure we have a playlist to reference
  if (!createdPlaylistId) {
    console.log('❌ No playlist available to reference in group. Create a playlist first.');
    return false;
  }
  console.log(`🔍 Using playlist ID: ${createdPlaylistId}`);

  // Create playlist group data with real playlist reference
  // For testing, we need to use an actual fetchable URL since the server validates external playlists
  // We'll use a real example playlist from the DP-1 spec for testing
  const playlistUrl = `http://localhost:8787/api/v1/playlists/${createdPlaylistId}`;

  const playlistGroupData = {
    title: 'Digital Art Showcase 2024',
    curator: 'Test Curator',
    summary: 'A test exhibition for API validation with UUID and slug support',
    playlists: [playlistUrl],
  };

  const response = await makeRequest('POST', '/api/v1/playlist-groups', playlistGroupData);

  if (response.ok) {
    console.log('✅ Playlist group created successfully');
    console.log(`   ID: ${response.data.id}`);
    console.log(`   Slug: ${response.data.slug}`);
    console.log(`   Title: ${response.data.title}`);
    console.log(`   Created: ${response.data.created}`);

    // Store server-generated data
    createdPlaylistGroupId = response.data.id;
    createdPlaylistGroupSlug = response.data.slug;

    // Validate UUID format
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(response.data.id)) {
      console.log('✅ Server-generated group UUID format is valid');
    } else {
      console.log('❌ Server-generated group UUID format is invalid');
      return false;
    }

    // Validate slug format
    if (response.data.slug && /^[a-zA-Z0-9-]+-\d{4}$/.test(response.data.slug)) {
      console.log('✅ Server-generated group slug format is valid');
    } else {
      console.log('❌ Server-generated group slug format is invalid or missing');
      return false;
    }
  } else {
    console.log(`❌ Failed: ${response.status} - ${JSON.stringify(response.data)}`);
  }

  return response.ok;
}

async function testListPlaylistGroups() {
  console.log('\n📋 Testing GET /api/v1/playlist-groups (list all groups)...');
  const response = await makeRequest('GET', '/api/v1/playlist-groups');

  if (response.ok) {
    console.log('✅ Playlist groups listed successfully');
    // Handle paginated result format
    const paginatedResult = response.data;
    if (paginatedResult && Array.isArray(paginatedResult.items)) {
      console.log(`   Count: ${paginatedResult.items.length}`);
      console.log(`   Has more: ${paginatedResult.hasMore || false}`);
      console.log(`   Cursor: ${paginatedResult.cursor ? 'Present' : 'None'}`);
      if (paginatedResult.items.length > 0) {
        console.log(`   First group ID: ${paginatedResult.items[0].id}`);
        if (paginatedResult.items[0].slug) {
          console.log(`   First group slug: ${paginatedResult.items[0].slug}`);
        }
      }
    } else {
      console.log('❌ Expected paginated result format with items array');
      return false;
    }
  } else {
    console.log(`❌ Failed: ${response.status} - ${JSON.stringify(response.data)}`);
  }

  return response.ok;
}

async function testGetPlaylistGroupByUUID() {
  if (!createdPlaylistGroupId) {
    console.log('\n⚠️  Skipping group UUID test - no group ID available');
    return true;
  }

  console.log('\n📖 Testing GET /api/v1/playlist-groups/{uuid} (access by UUID)...');
  const response = await makeRequest('GET', `/api/v1/playlist-groups/${createdPlaylistGroupId}`);

  if (response.ok) {
    console.log('✅ Playlist group retrieved by UUID successfully');
    console.log(`   ID: ${response.data.id}`);
    console.log(`   Slug: ${response.data.slug}`);
    console.log(`   Curator: ${response.data.curator}`);
  } else {
    console.log(`❌ Failed: ${response.status} - ${JSON.stringify(response.data)}`);
  }

  return response.ok;
}

async function testGetPlaylistGroupBySlug() {
  if (!createdPlaylistGroupSlug) {
    console.log('\n⚠️  Skipping group slug test - no slug available');
    return true;
  }

  console.log('\n📖 Testing GET /api/v1/playlist-groups/{slug} (access by slug)...');
  const response = await makeRequest('GET', `/api/v1/playlist-groups/${createdPlaylistGroupSlug}`);

  if (response.ok) {
    console.log('✅ Playlist group retrieved by slug successfully');
    console.log(`   ID: ${response.data.id}`);
    console.log(`   Slug: ${response.data.slug}`);

    // Verify we get the same group
    if (response.data.id === createdPlaylistGroupId) {
      console.log('✅ Same playlist group returned via slug and UUID');
    } else {
      console.log('❌ Different playlist group returned via slug vs UUID');
      return false;
    }
  } else {
    console.log(`❌ Failed: ${response.status} - ${JSON.stringify(response.data)}`);
  }

  return response.ok;
}

async function testInvalidIdentifiers() {
  console.log('\n🚫 Testing invalid identifier rejection...');

  // Test IDs that should be rejected with 400 (invalid format)
  const invalidIds = ['invalid_id_with_underscores', 'invalid@email.com', 'spaces in id'];

  // Test IDs that should return 404 (valid format but not found)
  const notFoundIds = [
    '123-abc-invalid-uuid',
    'valid-slug-not-found',
    '00000000-0000-0000-0000-000000000000',
  ];

  let allCorrect = true;

  // Test invalid format IDs (should get 400)
  for (const invalidId of invalidIds) {
    const response = await makeRequest('GET', `/api/v1/playlists/${invalidId}`);
    if (response.status === 400) {
      console.log(`✅ Correctly rejected invalid ID: ${invalidId}`);
    } else {
      console.log(`❌ Failed to reject invalid ID: ${invalidId} (got ${response.status})`);
      allCorrect = false;
    }
  }

  // Test valid format but not found IDs (should get 404)
  for (const notFoundId of notFoundIds) {
    const response = await makeRequest('GET', `/api/v1/playlists/${notFoundId}`);
    if (response.status === 404) {
      console.log(`✅ Correctly returned 404 for valid format but not found: ${notFoundId}`);
    } else {
      console.log(`❌ Expected 404 for not found ID: ${notFoundId} (got ${response.status})`);
      allCorrect = false;
    }
  }

  return allCorrect;
}

async function testAuthenticationFailure() {
  console.log('\n🔐 Testing authentication failure...');
  const response = await fetch(`${baseUrl}/api/v1/playlists`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer invalid-token',
    },
    body: JSON.stringify(testPlaylist),
  });

  if (response.status === 401) {
    console.log('✅ Authentication properly rejected invalid token');
  } else {
    console.log(`❌ Expected 401, got ${response.status}`);
  }

  return response.status === 401;
}

async function testEmptyListing() {
  console.log('\n📋 Testing empty listings behavior...');

  // Create a fresh API that might be empty
  const emptyResponse = await makeRequest('GET', '/api/v1/playlists');
  const emptyGroupsResponse = await makeRequest('GET', '/api/v1/playlist-groups');

  if (emptyResponse.ok && emptyGroupsResponse.ok) {
    console.log('✅ Empty listings handled correctly');

    // Check if both return paginated format
    const playlistResult = emptyResponse.data;
    const groupResult = emptyGroupsResponse.data;

    const playlistsValid = playlistResult && Array.isArray(playlistResult.items);
    const groupsValid = groupResult && Array.isArray(groupResult.items);

    console.log(`   Playlists returned: ${playlistsValid ? 'paginated format' : 'invalid format'}`);
    console.log(`   Groups returned: ${groupsValid ? 'paginated format' : 'invalid format'}`);

    return playlistsValid && groupsValid;
  } else {
    console.log(`❌ Failed empty listing test`);
    return false;
  }
}

async function testPlaylistItemById() {
  if (!createdPlaylistId) {
    console.log('\n⚠️  Skipping playlist item by ID test - no playlist ID available');
    return true;
  }

  console.log('\n🎯 Testing GET /api/v1/playlist-items/{id}...');

  // First get the playlist to find an item ID
  const playlistResponse = await makeRequest('GET', `/api/v1/playlists/${createdPlaylistId}`);
  if (
    !playlistResponse.ok ||
    !playlistResponse.data.items ||
    playlistResponse.data.items.length === 0
  ) {
    console.log('❌ Failed to get playlist or playlist has no items');
    return false;
  }

  const playlistItemId = playlistResponse.data.items[0].id;
  console.log(`   Testing with playlist item ID: ${playlistItemId}`);

  const response = await makeRequest('GET', `/api/v1/playlist-items/${playlistItemId}`);

  if (response.ok) {
    console.log('✅ Playlist item retrieved successfully');
    console.log(`   ID: ${response.data.id}`);
    console.log(`   Title: ${response.data.title || 'N/A'}`);
    console.log(`   Source: ${response.data.source}`);
    console.log(`   Duration: ${response.data.duration}`);
    console.log(`   License: ${response.data.license}`);

    if (response.data.id === playlistItemId) {
      console.log('✅ Correct playlist item returned');
    } else {
      console.log('❌ Wrong playlist item returned');
      return false;
    }
  } else {
    console.log(`❌ Failed: ${response.status} - ${JSON.stringify(response.data)}`);
  }

  return response.ok;
}

async function testPlaylistItemsByGroup() {
  if (!createdPlaylistGroupId) {
    console.log('\n⚠️  Skipping playlist items by group test - no playlist group ID available');
    return true;
  }

  console.log('\n📂 Testing GET /api/v1/playlist-items?playlist-group={id}...');
  const response = await makeRequest(
    'GET',
    `/api/v1/playlist-items?playlist-group=${createdPlaylistGroupId}`
  );

  if (response.ok) {
    console.log('✅ Playlist items retrieved by group successfully');
    const result = response.data;

    if (result && Array.isArray(result.items)) {
      console.log(`   Count: ${result.items.length}`);
      console.log(`   Has more: ${result.hasMore || false}`);

      if (result.items.length > 0) {
        console.log(`   First item ID: ${result.items[0].id}`);
        console.log(`   First item title: ${result.items[0].title || 'N/A'}`);
      }
    } else {
      console.log('❌ Expected paginated result format with items array');
      return false;
    }
  } else {
    console.log(`❌ Failed: ${response.status} - ${JSON.stringify(response.data)}`);
  }

  return response.ok;
}

async function testPlaylistItemsDoesNotRequiredParameter() {
  console.log('\n🚫 Testing playlist items endpoint does not require playlist-group parameter...');
  const response = await makeRequest('GET', '/api/v1/playlist-items');

  if (response.status === 200) {
    console.log('✅ Correctly returned 200 without playlist-group parameter');
  } else {
    console.log(`❌ Expected 200, got ${response.status}`);
    return false;
  }

  return true;
}

async function testPlaylistItemsInvalidIds() {
  console.log('\n🚫 Testing playlist items with invalid IDs...');

  let allCorrect = true;

  // Test invalid playlist item ID format
  const invalidItemResponse = await makeRequest('GET', '/api/v1/playlist-items/invalid-id');
  if (invalidItemResponse.status === 400) {
    console.log('✅ Correctly rejected invalid playlist item ID format');
  } else {
    console.log(`❌ Expected 400 for invalid playlist item ID, got ${invalidItemResponse.status}`);
    allCorrect = false;
  }

  // Test invalid playlist group ID format
  const invalidGroupResponse = await makeRequest(
    'GET',
    '/api/v1/playlist-items?playlist-group=invalid@id'
  );
  if (invalidGroupResponse.status === 400) {
    console.log('✅ Correctly rejected invalid playlist group ID format');
  } else {
    console.log(
      `❌ Expected 400 for invalid playlist group ID, got ${invalidGroupResponse.status}`
    );
    allCorrect = false;
  }

  // Test non-existent playlist item ID (valid format but not found)
  const notFoundItemResponse = await makeRequest(
    'GET',
    '/api/v1/playlist-items/00000000-0000-0000-0000-000000000000'
  );
  if (notFoundItemResponse.status === 404) {
    console.log('✅ Correctly returned 404 for non-existent playlist item');
  } else {
    console.log(
      `❌ Expected 404 for non-existent playlist item, got ${notFoundItemResponse.status}`
    );
    allCorrect = false;
  }

  return allCorrect;
}

async function testPlaylistItemsPagination() {
  if (!createdPlaylistGroupId) {
    console.log('\n⚠️  Skipping playlist items pagination test - no playlist group ID available');
    return true;
  }

  console.log('\n📄 Testing playlist items pagination...');

  // Test with limit
  const limitResponse = await makeRequest(
    'GET',
    `/api/v1/playlist-items?playlist-group=${createdPlaylistGroupId}&limit=1`
  );

  if (limitResponse.ok) {
    const result = limitResponse.data;
    if (result.items && result.items.length <= 1) {
      console.log('✅ Limit parameter working correctly for playlist items');

      // If there are more items and a cursor, test cursor pagination
      if (result.cursor && result.hasMore) {
        const cursorResponse = await makeRequest(
          'GET',
          `/api/v1/playlist-items?playlist-group=${createdPlaylistGroupId}&limit=1&cursor=${encodeURIComponent(result.cursor)}`
        );
        if (cursorResponse.ok) {
          console.log('✅ Cursor pagination working correctly for playlist items');
        } else {
          console.log('❌ Cursor pagination failed for playlist items');
          return false;
        }
      } else {
        console.log('ℹ️  No cursor available for playlist items (only one page of results)');
      }
    } else {
      console.log('❌ Limit parameter not working correctly for playlist items');
      return false;
    }
  } else {
    console.log(`❌ Playlist items pagination test failed: ${limitResponse.status}`);
    return false;
  }

  return true;
}

async function testPlaylistItemsUpdate() {
  if (!createdPlaylistId) {
    console.log('\n⚠️  Skipping playlist items update test - no playlist ID available');
    return true;
  }

  console.log('\n🔄 Testing playlist items update via playlist update...');

  // First get the current playlist item ID
  const initialPlaylist = await makeRequest('GET', `/api/v1/playlists/${createdPlaylistId}`);
  if (
    !initialPlaylist.ok ||
    !initialPlaylist.data.items ||
    initialPlaylist.data.items.length === 0
  ) {
    console.log('❌ Failed to get initial playlist or playlist has no items');
    return false;
  }

  const originalItemId = initialPlaylist.data.items[0].id;
  console.log(`   Original playlist item ID: ${originalItemId}`);

  // Update the playlist with new items
  const updateData = {
    items: [
      {
        title: 'Updated Test Artwork',
        source: 'https://example.com/updated-artwork.html',
        duration: 600,
        license: 'token',
      },
    ],
  };

  const updateResponse = await makeRequest(
    'PUT',
    `/api/v1/playlists/${createdPlaylistId}`,
    updateData
  );

  if (!updateResponse.ok) {
    console.log(`❌ Failed to update playlist: ${updateResponse.status}`);
    return false;
  }

  const updatedPlaylist = updateResponse.data;
  const newItemId = updatedPlaylist.items[0].id;
  console.log(`   New playlist item ID: ${newItemId}`);

  // Verify the new item ID is different
  if (newItemId !== originalItemId) {
    console.log('✅ New playlist item has different ID (old item was replaced)');
  } else {
    console.log('❌ Playlist item ID did not change (should be replaced)');
    return false;
  }

  // Verify the old item is no longer accessible
  const oldItemResponse = await makeRequest('GET', `/api/v1/playlist-items/${originalItemId}`);
  if (oldItemResponse.status === 404) {
    console.log('✅ Old playlist item no longer accessible');
  } else {
    console.log(`❌ Old playlist item still accessible (status: ${oldItemResponse.status})`);
    return false;
  }

  // Verify the new item is accessible
  const newItemResponse = await makeRequest('GET', `/api/v1/playlist-items/${newItemId}`);
  if (newItemResponse.ok) {
    console.log('✅ New playlist item is accessible');
    const newItem = newItemResponse.data;
    if (newItem.title === 'Updated Test Artwork' && newItem.license === 'token') {
      console.log('✅ New playlist item has correct updated data');
    } else {
      console.log('❌ New playlist item does not have expected updated data');
      return false;
    }
  } else {
    console.log(`❌ New playlist item not accessible (status: ${newItemResponse.status})`);
    return false;
  }

  return true;
}

// Main test runner
async function runTests() {
  console.log('🚀 Starting DP-1 Feed Operator API Tests (UUID + Slug Support)\n');

  const tests = [
    { name: 'Empty Listings', fn: testEmptyListing },
    { name: 'List Playlists', fn: testListPlaylists },
    { name: 'Pagination', fn: testPagination },
    { name: 'Create Playlist (UUID + Slug)', fn: testCreatePlaylist },
    { name: 'Get Playlist by UUID', fn: testGetPlaylistByUUID },
    { name: 'Get Playlist by Slug', fn: testGetPlaylistBySlug },
    { name: 'Update Playlist (Slug Regeneration)', fn: testUpdatePlaylist },
    { name: 'Create Playlist Group (UUID + Slug)', fn: testCreatePlaylistGroup },
    { name: 'List Playlist Groups', fn: testListPlaylistGroups },
    { name: 'Get Playlist Group by UUID', fn: testGetPlaylistGroupByUUID },
    { name: 'Get Playlist Group by Slug', fn: testGetPlaylistGroupBySlug },
    { name: 'Playlist Group Filtering', fn: testPlaylistGroupFiltering },
    { name: 'Get Playlist Item by ID', fn: testPlaylistItemById },
    { name: 'List Playlist Items by Group', fn: testPlaylistItemsByGroup },
    {
      name: 'Playlist Items Does Not Required Parameter',
      fn: testPlaylistItemsDoesNotRequiredParameter,
    },
    { name: 'Playlist Items Invalid IDs', fn: testPlaylistItemsInvalidIds },
    { name: 'Playlist Items Pagination', fn: testPlaylistItemsPagination },
    { name: 'Playlist Items Update via Playlist', fn: testPlaylistItemsUpdate },
    { name: 'Identifier Validation (400/404)', fn: testInvalidIdentifiers },
    { name: 'Authentication Failure', fn: testAuthenticationFailure },
  ];

  const results = [];

  for (const test of tests) {
    try {
      console.log(`\n🧪 Running: ${test.name}`);
      const result = await test.fn();
      results.push({ name: test.name, passed: result });
    } catch (error) {
      console.log(`❌ Test error: ${error.message}`);
      results.push({ name: test.name, passed: false });
    }
  }

  // Summary
  const passed = results.filter(r => r.passed).length;
  const total = results.length;

  console.log('\n📊 Test Results Summary:');
  console.log('═══════════════════════════════════════');

  results.forEach(result => {
    const icon = result.passed ? '✅' : '❌';
    console.log(`${icon} ${result.name}`);
  });

  console.log('═══════════════════════════════════════');
  console.log(`   Passed: ${passed}/${total}`);
  console.log(`   Failed: ${total - passed}/${total}`);

  if (passed === total) {
    console.log(
      '\n🎉 All tests passed! Your DP-1 Feed Operator API is working correctly with UUID and slug support.'
    );
  } else {
    console.log('\n⚠️  Some tests failed. Please check the output above for details.');
    process.exit(1);
  }
}

// Polyfill for fetch if not available (Node.js < 18)
if (typeof fetch === 'undefined') {
  console.log('📦 Installing fetch polyfill...');
  try {
    const { default: fetch } = await import('node-fetch');
    global.fetch = fetch;
  } catch (error) {
    console.error('❌ fetch not available. Please use Node.js 18+ or install node-fetch');
    process.exit(1);
  }
}

// Run the tests
runTests().catch(error => {
  console.error('❌ Test runner failed:', error);
  process.exit(1);
});
