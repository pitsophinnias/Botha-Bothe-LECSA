document.addEventListener('DOMContentLoaded', function() {
    // Initialize mock data storage
    const mockData = {
        members: [
            { id: 1, palo: 1, lebitso: 'John', fane: 'Doe', archived: false, status: 'Active', createdAt: new Date('2024-01-01').toISOString() },
            { id: 2, palo: 2, lebitso: 'Jane', fane: 'Smith', archived: false, status: 'Active', createdAt: new Date('2024-01-02').toISOString() }
        ],
        baptisms: [],
        weddings: [],
        financials: [],
        archives: []
    };
    
    // Generate unique ID
    let nextMemberId = 3;
    let nextBaptismId = 1;
    let nextWeddingId = 1;
    let nextFinancialId = 1;
    
    // Store in localStorage for persistence across page reloads
    function loadMockData() {
        const saved = localStorage.getItem('mockBackendData');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                Object.assign(mockData, parsed);
                
                // Update next IDs based on loaded data
                nextMemberId = Math.max(...mockData.members.map(m => m.id), 0) + 1;
                nextBaptismId = Math.max(...mockData.baptisms.map(b => b.id), 0) + 1;
                nextWeddingId = Math.max(...mockData.weddings.map(w => w.id), 0) + 1;
                nextFinancialId = Math.max(...mockData.financials.map(f => f.id), 0) + 1;
                
                console.log('Loaded mock data from localStorage:', mockData);
            } catch (e) {
                console.warn('Failed to load mock data from localStorage:', e);
            }
        }
    }
    
    function saveMockData() {
        try {
            localStorage.setItem('mockBackendData', JSON.stringify(mockData));
        } catch (e) {
            console.warn('Failed to save mock data to localStorage:', e);
        }
    }
    
    // Load initial data
    loadMockData();
    console.log('Initial mock data loaded:', mockData);
    
    // Intercept fetch requests
    const originalFetch = window.fetch;
    
    window.fetch = async function(resource, options = {}) {
        const url = resource;
        const method = options.method || 'GET';
        
        console.log(`Mock intercepting ${method} ${url}`);
        
        // Mock responses for development
        if (url.includes('/api/members')) {
            if (method === 'POST') {
                // Check for role
                const token = options.headers?.Authorization?.split(' ')[1];
                if (!token) {
                    return Promise.resolve({
                        ok: false,
                        status: 401,
                        json: () => Promise.resolve({ error: 'Unauthorized' })
                    });
                }
                
                // Parse token to get role
                try {
                    const payload = JSON.parse(atob(token.split('.')[1]));
                    const role = payload.role || localStorage.getItem('role');
                    
                    if (!role) {
                        return Promise.resolve({
                            ok: false,
                            status: 403,
                            json: () => Promise.resolve({ error: 'Role not found' })
                        });
                    }
                    
                    if (role === 'board_member') {
                        return Promise.resolve({
                            ok: false,
                            status: 403,
                            json: () => Promise.resolve({ error: 'Insufficient permissions' })
                        });
                    }
                    
                    // Parse request body
                    const body = JSON.parse(options.body || '{}');
                    console.log('POST /api/members body:', body);
                    
                    // Generate member number
                    const highestPalo = mockData.members.reduce((max, member) => 
                        Math.max(max, member.palo || 0), 0);
                    
                    // Create new member
                    const newMember = {
                        id: nextMemberId++,
                        palo: highestPalo + 1,
                        lebitso: body.lebitso || '',
                        fane: body.fane || '',
                        gender: body.gender || 'Male',
                        dob: body.dob || '',
                        phone: body.phone || '',
                        address: body.address || '',
                        email: body.email || '',
                        status: body.status || 'Active',
                        occupation: body.occupation || '',
                        marital_status: body.marital_status || '',
                        baptized: body.baptized || false,
                        archived: false,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    };
                    
                    // Add to mock data
                    mockData.members.unshift(newMember); // Add to beginning
                    saveMockData();
                    
                    console.log('New member added:', newMember);
                    console.log('Total members now:', mockData.members.length);
                    
                    // Success response
                    return Promise.resolve({
                        ok: true,
                        status: 200,
                        json: () => Promise.resolve({
                            message: 'Member registered successfully',
                            member: newMember
                        })
                    });
                } catch (e) {
                    console.error('Error processing POST /api/members:', e);
                    return Promise.resolve({
                        ok: false,
                        status: 400,
                        json: () => Promise.resolve({ error: 'Invalid request' })
                    });
                }
            }
            
            if (method === 'GET') {
                try {
                    const token = options.headers?.Authorization?.split(' ')[1];
                    if (!token) {
                        return Promise.resolve({
                            ok: false,
                            status: 401,
                            json: () => Promise.resolve({ error: 'Unauthorized' })
                        });
                    }
                    
                    // Parse URL to get query parameters
                    const urlObj = new URL(url, window.location.origin);
                    const search = urlObj.searchParams.get('search') || '';
                    const limit = parseInt(urlObj.searchParams.get('limit')) || mockData.members.length;
                    const order = urlObj.searchParams.get('order') || 'desc';
                    const archived = urlObj.searchParams.get('archived');
                    
                    // Filter members
                    let filteredMembers = [...mockData.members];
                    
                    // Apply search filter
                    if (search) {
                        const searchLower = search.toLowerCase();
                        filteredMembers = filteredMembers.filter(member => 
                            (member.lebitso && member.lebitso.toLowerCase().includes(searchLower)) ||
                            (member.fane && member.fane.toLowerCase().includes(searchLower)) ||
                            (member.phone && member.phone.includes(search))
                        );
                    }
                    
                    // Apply archived filter
                    if (archived !== null) {
                        const showArchived = archived === 'true';
                        filteredMembers = filteredMembers.filter(member => 
                            member.archived === showArchived
                        );
                    } else {
                        // Default: show non-archived
                        filteredMembers = filteredMembers.filter(member => !member.archived);
                    }
                    
                    // Apply ordering
                    if (order === 'desc') {
                        filteredMembers.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                    } else {
                        filteredMembers.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
                    }
                    
                    // Apply limit
                    filteredMembers = filteredMembers.slice(0, limit);
                    
                    console.log(`GET /api/members returning ${filteredMembers.length} members`);
                    
                    return Promise.resolve({
                        ok: true,
                        status: 200,
                        json: () => Promise.resolve(filteredMembers)
                    });
                } catch (e) {
                    console.error('Error processing GET /api/members:', e);
                    return Promise.resolve({
                        ok: true,
                        status: 200,
                        json: () => Promise.resolve([])
                    });
                }
            }
            
            if (method === 'PUT' || method === 'PATCH') {
                // Handle member updates
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: () => Promise.resolve({ message: 'Member updated successfully' })
                });
            }
            
            if (method === 'DELETE') {
                // Handle member deletion (archive)
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: () => Promise.resolve({ message: 'Member archived successfully' })
                });
            }
        }
        
        if (url.includes('/api/baptisms')) {
            if (method === 'POST') {
                try {
                    const body = JSON.parse(options.body || '{}');
                    const newBaptism = {
                        id: nextBaptismId++,
                        first_name: body.first_name || '',
                        surname: body.surname || '',
                        baptism_date: body.baptism_date || new Date().toISOString().split('T')[0],
                        member_id: body.member_id || null,
                        archived: false,
                        createdAt: new Date().toISOString()
                    };
                    
                    mockData.baptisms.unshift(newBaptism);
                    saveMockData();
                    
                    return Promise.resolve({
                        ok: true,
                        status: 200,
                        json: () => Promise.resolve({
                            message: 'Baptism recorded successfully',
                            baptism: newBaptism
                        })
                    });
                } catch (e) {
                    return Promise.resolve({
                        ok: false,
                        status: 400,
                        json: () => Promise.resolve({ error: 'Invalid request' })
                    });
                }
            }
            
            if (method === 'GET') {
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: () => Promise.resolve(mockData.baptisms.filter(b => !b.archived))
                });
            }
        }
        
        if (url.includes('/api/weddings')) {
            if (method === 'POST') {
                try {
                    const body = JSON.parse(options.body || '{}');
                    const newWedding = {
                        id: nextWeddingId++,
                        groom_first_name: body.groom_first_name || '',
                        groom_surname: body.groom_surname || '',
                        bride_first_name: body.bride_first_name || '',
                        bride_surname: body.bride_surname || '',
                        wedding_date: body.wedding_date || new Date().toISOString().split('T')[0],
                        archived: false,
                        createdAt: new Date().toISOString()
                    };
                    
                    mockData.weddings.unshift(newWedding);
                    saveMockData();
                    
                    return Promise.resolve({
                        ok: true,
                        status: 200,
                        json: () => Promise.resolve({
                            message: 'Wedding recorded successfully',
                            wedding: newWedding
                        })
                    });
                } catch (e) {
                    return Promise.resolve({
                        ok: false,
                        status: 400,
                        json: () => Promise.resolve({ error: 'Invalid request' })
                    });
                }
            }
            
            if (method === 'GET') {
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: () => Promise.resolve(mockData.weddings.filter(w => !w.archived))
                });
            }
        }
        
        if (url.includes('/api/financials')) {
            if (method === 'POST') {
                try {
                    const body = JSON.parse(options.body || '{}');
                    const newTransaction = {
                        id: nextFinancialId++,
                        date: body.date || new Date().toISOString().split('T')[0],
                        description: body.description || '',
                        category: body.category || 'Other',
                        amount: parseFloat(body.amount) || 0,
                        type: body.type || 'income',
                        createdAt: new Date().toISOString()
                    };
                    
                    mockData.financials.unshift(newTransaction);
                    saveMockData();
                    
                    return Promise.resolve({
                        ok: true,
                        status: 200,
                        json: () => Promise.resolve({
                            message: 'Transaction recorded successfully',
                            transaction: newTransaction
                        })
                    });
                } catch (e) {
                    return Promise.resolve({
                        ok: false,
                        status: 400,
                        json: () => Promise.resolve({ error: 'Invalid request' })
                    });
                }
            }
            
            if (method === 'GET') {
                try {
                    const urlObj = new URL(url, window.location.origin);
                    const period = urlObj.searchParams.get('period');
                    
                    if (period === 'weekly') {
                        // Return recent transactions
                        const recentTransactions = mockData.financials
                            .slice(0, 10)
                            .map(t => ({
                                date: t.date,
                                description: t.description,
                                category: t.category,
                                amount: t.amount,
                                type: t.type
                            }));
                        
                        return Promise.resolve({
                            ok: true,
                            status: 200,
                            json: () => Promise.resolve(recentTransactions)
                        });
                    } else {
                        // Return monthly summary
                        const summary = [
                            { month: 'January 2024', income: 6000, expenses: 1200, balance: 4800 },
                            { month: 'February 2024', income: 5500, expenses: 1000, balance: 4500 }
                        ];
                        
                        return Promise.resolve({
                            ok: true,
                            status: 200,
                            json: () => Promise.resolve(summary)
                        });
                    }
                } catch (e) {
                    return Promise.resolve({
                        ok: true,
                        status: 200,
                        json: () => Promise.resolve([])
                    });
                }
            }
        }
        
        if (url.includes('/api/archives')) {
            if (method === 'GET') {
                // Combine archived records from all categories
                const archivedRecords = [
                    ...mockData.members.filter(m => m.archived).map(m => ({
                        id: m.id,
                        record_type: 'member',
                        details: { lebitso: m.lebitso, fane: m.fane, status: m.status },
                        palo: m.palo,
                        archivedAt: m.updatedAt
                    })),
                    ...mockData.baptisms.filter(b => b.archived).map(b => ({
                        id: b.id,
                        record_type: 'baptism',
                        details: { first_name: b.first_name, surname: b.surname, baptism_date: b.baptism_date },
                        archivedAt: b.updatedAt
                    })),
                    ...mockData.weddings.filter(w => w.archived).map(w => ({
                        id: w.id,
                        record_type: 'wedding',
                        details: { 
                            groom_name: `${w.groom_first_name} ${w.groom_surname}`,
                            bride_name: `${w.bride_first_name} ${w.bride_surname}`,
                            wedding_date: w.wedding_date 
                        },
                        archivedAt: w.updatedAt
                    }))
                ];
                
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: () => Promise.resolve(archivedRecords)
                });
            }
        }
        
        if (url.includes('/api/verify-token')) {
            // Mock token verification
            const token = options.headers?.Authorization?.split(' ')[1];
            if (!token) {
                return Promise.resolve({
                    ok: false,
                    status: 401,
                    json: () => Promise.resolve({ error: 'No token provided' })
                });
            }
            
            try {
                // Mock token validation
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: () => Promise.resolve({ 
                        valid: true,
                        user: { 
                            id: 'e7903b5f-10f6-4593-a6f1-484164bf872a',
                            username: 'Pitso',
                            role: 'user'
                        }
                    })
                });
            } catch (e) {
                return Promise.resolve({
                    ok: false,
                    status: 401,
                    json: () => Promise.resolve({ error: 'Invalid token' })
                });
            }
        }
        
        if (url.includes('/api/auth/login')) {
            if (method === 'POST') {
                try {
                    const body = JSON.parse(options.body || '{}');
                    const { username, password } = body;
                    
                    // Mock authentication
                    if (username === 'Pitso' && password === 'password123') {
                        const mockToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJlNzkwM2I1Zi0xMGY2LTQ1OTMtYTZmMS00ODQxNjRiZjg3MmEiLCJ1c2VybmFtZSI6IlBpdHNvIiwicm9sZSI6InVzZXIiLCJpYXQiOjE3MDYyMDAwMDB9.mock-signature-for-development';
                        
                        return Promise.resolve({
                            ok: true,
                            status: 200,
                            json: () => Promise.resolve({
                                token: mockToken,
                                user: {
                                    id: 'e7903b5f-10f6-4593-a6f1-484164bf872a',
                                    username: 'Pitso',
                                    role: 'user'
                                }
                            })
                        });
                    } else {
                        return Promise.resolve({
                            ok: false,
                            status: 401,
                            json: () => Promise.resolve({ error: 'Invalid username or password' })
                        });
                    }
                } catch (e) {
                    return Promise.resolve({
                        ok: false,
                        status: 400,
                        json: () => Promise.resolve({ error: 'Invalid request' })
                    });
                }
            }
        }
        
        // For all other requests, use original fetch
        console.log(`Passing through to original fetch: ${method} ${url}`);
        return originalFetch.call(this, resource, options);
    };
    
    // Add debug function to window
    window.debugMockData = function() {
        console.log('=== MOCK DATA DEBUG ===');
        console.log('Members:', mockData.members);
        console.log('Baptisms:', mockData.baptisms);
        console.log('Weddings:', mockData.weddings);
        console.log('Financials:', mockData.financials);
        console.log('Next IDs - Members:', nextMemberId, 'Baptisms:', nextBaptismId, 'Weddings:', nextWeddingId);
        console.log('=== END DEBUG ===');
        
        return mockData;
    };
    
    // Add function to reset mock data
    window.resetMockData = function() {
        mockData.members = [
            { id: 1, palo: 1, lebitso: 'John', fane: 'Doe', archived: false, status: 'Active', createdAt: new Date('2024-01-01').toISOString() },
            { id: 2, palo: 2, lebitso: 'Jane', fane: 'Smith', archived: false, status: 'Active', createdAt: new Date('2024-01-02').toISOString() }
        ];
        mockData.baptisms = [];
        mockData.weddings = [];
        mockData.financials = [];
        mockData.archives = [];
        
        nextMemberId = 3;
        nextBaptismId = 1;
        nextWeddingId = 1;
        nextFinancialId = 1;
        
        saveMockData();
        console.log('Mock data reset to defaults');
    };
    
    console.log('Backend mock initialized with data persistence');
    console.log('Available debug commands:');
    console.log('- debugMockData(): View current mock data');
    console.log('- resetMockData(): Reset mock data to defaults');
});