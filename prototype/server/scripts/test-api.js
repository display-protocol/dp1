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

// Generate proper UUIDs for test data
const testPlaylistId = randomUUID();
const testPlaylistItemId = randomUUID();
const testPlaylistGroupId = randomUUID();

// Test data with proper UUIDs
const testPlaylist = {
  dpVersion: '1.0.0',
  id: testPlaylistId,
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
      id: testPlaylistItemId,
      title: 'My Amazing Test Artwork',
      source: 'https://example.com/test.html',
      duration: 300,
      license: 'open',
    },
  ],
};

const testPlaylistGroup = {
  id: testPlaylistGroupId,
  title: 'Digital Art Showcase 2024',
  curator: 'Test Curator',
  summary: 'A test exhibition for API validation with UUID and slug support',
  playlists: [`https://api.feed.feralfile.com/playlists/${testPlaylistId}/playlist.json`],
};

// Store generated slugs for testing
let createdPlaylistSlug = null;
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
  console.log('\n📋 Testing GET /playlists (list all playlists)...');
  const response = await makeRequest('GET', '/playlists');

  if (response.ok) {
    console.log('✅ Playlists listed successfully');
    const playlists = Array.isArray(response.data) ? response.data : [];
    console.log(`   Count: ${playlists.length}`);
    if (playlists.length > 0) {
      console.log(`   First playlist ID: ${playlists[0].id}`);
      if (playlists[0].slug) {
        console.log(`   First playlist slug: ${playlists[0].slug}`);
      }
    }
  } else {
    console.log(`❌ Failed: ${response.status} - ${JSON.stringify(response.data)}`);
  }

  return response.ok;
}

async function testCreatePlaylist() {
  console.log('\n📝 Testing POST /playlists (UUID and slug generation)...');
  const response = await makeRequest('POST', '/playlists', testPlaylist);

  if (response.ok) {
    console.log('✅ Playlist created successfully');
    console.log(`   ID: ${response.data.id}`);
    console.log(`   Slug: ${response.data.slug}`);
    console.log(`   Created: ${response.data.created}`);
    console.log(`   Signature: ${response.data.signature ? 'Present' : 'Missing'}`);

    // Validate slug format
    if (response.data.slug && /^[a-zA-Z0-9-]+-\d{4}$/.test(response.data.slug)) {
      console.log('✅ Slug format is valid');
      createdPlaylistSlug = response.data.slug;
    } else {
      console.log('❌ Slug format is invalid or missing');
      return false;
    }

    // Validate UUID format
    if (response.data.id === testPlaylistId) {
      console.log('✅ UUID preserved correctly');
    } else {
      console.log('❌ UUID not preserved correctly');
      return false;
    }
  } else {
    console.log(`❌ Failed: ${response.status} - ${JSON.stringify(response.data)}`);
  }

  return response.ok;
}

async function testGetPlaylistByUUID() {
  console.log('\n📖 Testing GET /playlists/{uuid} (access by UUID)...');
  const response = await makeRequest('GET', `/playlists/${testPlaylistId}`);

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

  console.log('\n📖 Testing GET /playlists/{slug} (access by slug)...');
  const response = await makeRequest('GET', `/playlists/${createdPlaylistSlug}`);

  if (response.ok) {
    console.log('✅ Playlist retrieved by slug successfully');
    console.log(`   ID: ${response.data.id}`);
    console.log(`   Slug: ${response.data.slug}`);

    // Verify we get the same playlist
    if (response.data.id === testPlaylistId) {
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
  console.log('\n📝 Testing PUT /playlists/{id} (slug regeneration)...');
  const updatedPlaylist = {
    ...testPlaylist,
    items: [
      {
        ...testPlaylist.items[0],
        title: 'Updated Amazing Digital Artwork',
      },
      {
        id: randomUUID(),
        title: 'Second Test Artwork',
        source: 'https://example.com/test2.html',
        duration: 180,
        license: 'token',
      },
    ],
  };

  const response = await makeRequest('PUT', `/playlists/${testPlaylistId}`, updatedPlaylist);

  if (response.ok) {
    console.log('✅ Playlist updated successfully');
    console.log(`   Items: ${response.data.items?.length || 0}`);
    console.log(`   New slug: ${response.data.slug}`);

    // Verify slug was regenerated from new title
    if (response.data.slug !== createdPlaylistSlug) {
      console.log('✅ Slug regenerated after title change');
      if (/^updated-amazing-digital-artwork-\d{4}$/.test(response.data.slug)) {
        console.log('✅ New slug format matches updated title');
      } else {
        console.log('❌ New slug format does not match expected pattern');
        return false;
      }
    } else {
      console.log('❌ Slug was not regenerated after title change');
      return false;
    }
  } else {
    console.log(`❌ Failed: ${response.status} - ${JSON.stringify(response.data)}`);
  }

  return response.ok;
}

async function testCreatePlaylistGroup() {
  console.log('\n📝 Testing POST /playlist-groups (UUID and slug generation)...');
  const response = await makeRequest('POST', '/playlist-groups', testPlaylistGroup);

  if (response.ok) {
    console.log('✅ Playlist group created successfully');
    console.log(`   ID: ${response.data.id}`);
    console.log(`   Slug: ${response.data.slug}`);
    console.log(`   Title: ${response.data.title}`);
    console.log(`   Created: ${response.data.created}`);

    // Validate slug format
    if (response.data.slug && /^[a-zA-Z0-9-]+-\d{4}$/.test(response.data.slug)) {
      console.log('✅ Group slug format is valid');
      createdPlaylistGroupSlug = response.data.slug;
    } else {
      console.log('❌ Group slug format is invalid or missing');
      return false;
    }

    // Validate UUID format
    if (response.data.id === testPlaylistGroupId) {
      console.log('✅ Group UUID preserved correctly');
    } else {
      console.log('❌ Group UUID not preserved correctly');
      return false;
    }
  } else {
    console.log(`❌ Failed: ${response.status} - ${JSON.stringify(response.data)}`);
  }

  return response.ok;
}

async function testListPlaylistGroups() {
  console.log('\n📋 Testing GET /playlist-groups (list all groups)...');
  const response = await makeRequest('GET', '/playlist-groups');

  if (response.ok) {
    console.log('✅ Playlist groups listed successfully');
    const groups = Array.isArray(response.data) ? response.data : [];
    console.log(`   Count: ${groups.length}`);
    if (groups.length > 0) {
      console.log(`   First group ID: ${groups[0].id}`);
      if (groups[0].slug) {
        console.log(`   First group slug: ${groups[0].slug}`);
      }
    }
  } else {
    console.log(`❌ Failed: ${response.status} - ${JSON.stringify(response.data)}`);
  }

  return response.ok;
}

async function testGetPlaylistGroupByUUID() {
  console.log('\n📖 Testing GET /playlist-groups/{uuid} (access by UUID)...');
  const response = await makeRequest('GET', `/playlist-groups/${testPlaylistGroupId}`);

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

  console.log('\n📖 Testing GET /playlist-groups/{slug} (access by slug)...');
  const response = await makeRequest('GET', `/playlist-groups/${createdPlaylistGroupSlug}`);

  if (response.ok) {
    console.log('✅ Playlist group retrieved by slug successfully');
    console.log(`   ID: ${response.data.id}`);
    console.log(`   Slug: ${response.data.slug}`);

    // Verify we get the same group
    if (response.data.id === testPlaylistGroupId) {
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
    const response = await makeRequest('GET', `/playlists/${invalidId}`);
    if (response.status === 400) {
      console.log(`✅ Correctly rejected invalid ID: ${invalidId}`);
    } else {
      console.log(`❌ Failed to reject invalid ID: ${invalidId} (got ${response.status})`);
      allCorrect = false;
    }
  }

  // Test valid format but not found IDs (should get 404)
  for (const notFoundId of notFoundIds) {
    const response = await makeRequest('GET', `/playlists/${notFoundId}`);
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
  const response = await fetch(`${baseUrl}/playlists`, {
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
  const emptyResponse = await makeRequest('GET', '/playlists');
  const emptyGroupsResponse = await makeRequest('GET', '/playlist-groups');

  if (emptyResponse.ok && emptyGroupsResponse.ok) {
    console.log('✅ Empty listings handled correctly');
    console.log(`   Playlists returned: ${Array.isArray(emptyResponse.data) ? 'array' : 'other'}`);
    console.log(
      `   Groups returned: ${Array.isArray(emptyGroupsResponse.data) ? 'array' : 'other'}`
    );
  } else {
    console.log(`❌ Failed empty listing test`);
  }

  return emptyResponse.ok && emptyGroupsResponse.ok;
}

// Main test runner
async function runTests() {
  console.log('🚀 Starting DP-1 Feed Operator API Tests (UUID + Slug Support)\n');
  console.log(`📋 Test Playlist UUID: ${testPlaylistId}`);
  console.log(`📋 Test Playlist Group UUID: ${testPlaylistGroupId}\n`);

  const tests = [
    { name: 'List Playlists', fn: testListPlaylists },
    { name: 'Empty Listings', fn: testEmptyListing },
    { name: 'Create Playlist (UUID + Slug)', fn: testCreatePlaylist },
    { name: 'Get Playlist by UUID', fn: testGetPlaylistByUUID },
    { name: 'Get Playlist by Slug', fn: testGetPlaylistBySlug },
    { name: 'Update Playlist (Slug Regeneration)', fn: testUpdatePlaylist },
    { name: 'Create Playlist Group (UUID + Slug)', fn: testCreatePlaylistGroup },
    { name: 'List Playlist Groups', fn: testListPlaylistGroups },
    { name: 'Get Playlist Group by UUID', fn: testGetPlaylistGroupByUUID },
    { name: 'Get Playlist Group by Slug', fn: testGetPlaylistGroupBySlug },
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
