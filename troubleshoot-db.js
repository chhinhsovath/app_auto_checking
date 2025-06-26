// Digital Ocean Database Connection Troubleshooting
const { spawn } = require('child_process');
const net = require('net');

const DO_CONFIG = {
  host: '137.184.109.21',
  port: 5432,
  user: 'postgres',
  database: 'staff_tracking_app',
  password: 'P@ssw0rd'
};

console.log('🔍 Digital Ocean Database Connection Troubleshooting\n');

// Test 1: Basic network connectivity
function testNetworkConnection() {
  return new Promise((resolve) => {
    console.log('📡 Test 1: Network connectivity to host...');
    
    const socket = new net.Socket();
    const timeout = setTimeout(() => {
      socket.destroy();
      console.log('❌ Network connection timeout');
      resolve(false);
    }, 10000);

    socket.connect(DO_CONFIG.port, DO_CONFIG.host, () => {
      clearTimeout(timeout);
      console.log('✅ Network connection successful');
      socket.destroy();
      resolve(true);
    });

    socket.on('error', (error) => {
      clearTimeout(timeout);
      console.log('❌ Network connection failed:', error.message);
      resolve(false);
    });
  });
}

// Test 2: PostgreSQL connection without SSL
function testBasicPsql() {
  return new Promise((resolve) => {
    console.log('\n🔐 Test 2: Basic PostgreSQL connection...');
    
    const psql = spawn('psql', [
      '-h', DO_CONFIG.host,
      '-U', DO_CONFIG.user,
      '-d', DO_CONFIG.database,
      '-c', 'SELECT version();'
    ], {
      env: { ...process.env, PGPASSWORD: DO_CONFIG.password },
      timeout: 15000
    });

    const timeout = setTimeout(() => {
      psql.kill();
      console.log('❌ PostgreSQL connection timeout');
      resolve(false);
    }, 20000);

    let output = '';
    let error = '';

    psql.stdout.on('data', (data) => {
      output += data.toString();
    });

    psql.stderr.on('data', (data) => {
      error += data.toString();
    });

    psql.on('close', (code) => {
      clearTimeout(timeout);
      if (code === 0) {
        console.log('✅ PostgreSQL connection successful');
        console.log('📊 Database version:', output.trim().split('\n')[0]);
        resolve(true);
      } else {
        console.log('❌ PostgreSQL connection failed');
        console.log('🔍 Error details:', error.trim());
        resolve(false);
      }
    });
  });
}

// Test 3: PostgreSQL connection with SSL
function testSslPsql() {
  return new Promise((resolve) => {
    console.log('\n🔒 Test 3: PostgreSQL with SSL...');
    
    const psql = spawn('psql', [
      '-h', DO_CONFIG.host,
      '-U', DO_CONFIG.user,
      '-d', DO_CONFIG.database,
      '-c', 'SELECT version();',
      'sslmode=require'
    ], {
      env: { ...process.env, PGPASSWORD: DO_CONFIG.password },
      timeout: 15000
    });

    const timeout = setTimeout(() => {
      psql.kill();
      console.log('❌ SSL PostgreSQL connection timeout');
      resolve(false);
    }, 20000);

    let output = '';
    let error = '';

    psql.stdout.on('data', (data) => {
      output += data.toString();
    });

    psql.stderr.on('data', (data) => {
      error += data.toString();
    });

    psql.on('close', (code) => {
      clearTimeout(timeout);
      if (code === 0) {
        console.log('✅ SSL PostgreSQL connection successful');
        console.log('📊 Database version:', output.trim().split('\n')[0]);
        resolve(true);
      } else {
        console.log('❌ SSL PostgreSQL connection failed');
        console.log('🔍 Error details:', error.trim());
        resolve(false);
      }
    });
  });
}

// Test 4: Check if database exists
function testDatabaseExists() {
  return new Promise((resolve) => {
    console.log('\n📋 Test 4: Check if database exists...');
    
    const psql = spawn('psql', [
      '-h', DO_CONFIG.host,
      '-U', DO_CONFIG.user,
      '-d', 'postgres', // Connect to default database first
      '-c', "SELECT 1 FROM pg_database WHERE datname='staff_tracking_app';"
    ], {
      env: { ...process.env, PGPASSWORD: DO_CONFIG.password },
      timeout: 15000
    });

    const timeout = setTimeout(() => {
      psql.kill();
      console.log('❌ Database check timeout');
      resolve(false);
    }, 20000);

    let output = '';
    let error = '';

    psql.stdout.on('data', (data) => {
      output += data.toString();
    });

    psql.stderr.on('data', (data) => {
      error += data.toString();
    });

    psql.on('close', (code) => {
      clearTimeout(timeout);
      if (code === 0) {
        if (output.includes('1')) {
          console.log('✅ Database "staff_tracking_app" exists');
          resolve(true);
        } else {
          console.log('❌ Database "staff_tracking_app" does not exist');
          console.log('💡 You may need to create it first');
          resolve(false);
        }
      } else {
        console.log('❌ Cannot check database existence');
        console.log('🔍 Error details:', error.trim());
        resolve(false);
      }
    });
  });
}

async function runDiagnostics() {
  console.log(`🎯 Target: ${DO_CONFIG.host}:${DO_CONFIG.port}`);
  console.log(`👤 User: ${DO_CONFIG.user}`);
  console.log(`💾 Database: ${DO_CONFIG.database}\n`);

  const networkOk = await testNetworkConnection();
  
  if (!networkOk) {
    console.log('\n💡 Recommendations:');
    console.log('   1. Check Digital Ocean firewall settings');
    console.log('   2. Ensure port 5432 is open for external connections');
    console.log('   3. Verify the IP address is correct');
    console.log('   4. Check if PostgreSQL is running on the server');
    return;
  }

  const basicOk = await testBasicPsql();
  const sslOk = await testSslPsql();
  const dbExists = await testDatabaseExists();

  console.log('\n📝 Summary:');
  console.log(`   Network Connection: ${networkOk ? '✅ OK' : '❌ Failed'}`);
  console.log(`   Basic PostgreSQL: ${basicOk ? '✅ OK' : '❌ Failed'}`);
  console.log(`   SSL PostgreSQL: ${sslOk ? '✅ OK' : '❌ Failed'}`);
  console.log(`   Database Exists: ${dbExists ? '✅ OK' : '❌ Failed'}`);

  if (basicOk || sslOk) {
    console.log('\n🎉 PostgreSQL connection is working!');
    console.log('   The server should be able to connect.');
    console.log('   If it still fails, check server logs for specific errors.');
  } else {
    console.log('\n💡 Recommendations:');
    console.log('   1. Check PostgreSQL configuration (postgresql.conf)');
    console.log('   2. Verify pg_hba.conf allows connections from your IP');
    console.log('   3. Ensure PostgreSQL is listening on external interfaces');
    console.log('   4. Check Digital Ocean database firewall rules');
    console.log('   5. Try connecting from Digital Ocean console first');
  }

  console.log('\n🔧 Current server status:');
  console.log('   Server is running on local database as fallback');
  console.log('   Visit http://localhost:3001/demo to test the system');
}

runDiagnostics();