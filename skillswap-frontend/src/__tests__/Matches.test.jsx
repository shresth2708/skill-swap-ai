import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import Matches from '../pages/Matches';
import { vi } from 'vitest';

// 1. Mock the API endpoint
const handlers = [
  http.get('*/matches', ({ request }) => {
    const url = new URL(request.url);
    const strategy = url.searchParams.get('strategy') || 'skill';
    
    // Simulate AI Hybrid integration data
    if (strategy === 'hybrid') {
      return HttpResponse.json({
        success: true,
        data: {
          meta: { strategy: 'hybrid' },
          matches: [
            {
              id: 'match-xyz',
              user: {
                id: 'u2',
                displayName: 'Node Ninja',
                location: 'San Francisco, CA',
                avatarUrl: null
              },
              compatibilityScore: 92,
              offeredSkills: ['Node.js', 'Express'],
              wantedSkills: ['React', 'TypeScript']
            }
          ]
        }
      });
    }

    // Default fallback
    return HttpResponse.json({
      success: true,
      data: {
        meta: { strategy },
        matches: []
      }
    });
  }),
  
  // Mock explanations
  http.post('*/matches/:matchId/explain', () => {
    return HttpResponse.json({
      success: true,
      data: {
        explanation: {
          score: 0.92,
          breakdown: [
            { label: 'AI Similarity', value: 80, color: 'bg-emerald-400' },
            { label: 'Location Proximity', value: 12, color: 'bg-cyan-400' }
          ]
        }
      }
    });
  })
];

const server = setupServer(...handlers);

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// Mock lucide icons if there are any issues rendering them in JSDOM
vi.mock('lucide-react', async (importOriginal) => {
  const mod = await importOriginal();
  return {
    ...mod,
    ArrowRightLeft: () => <span data-testid="icon-arrow-right-left" />,
    Info: () => <span data-testid="icon-info" />,
    MapPin: () => <span data-testid="icon-map-pin" />,
    Sparkles: () => <span data-testid="icon-sparkles" />,
    Star: () => <span data-testid="icon-star" />,
    UserPlus: () => <span data-testid="icon-user-plus" />,
    Search: () => <span data-testid="icon-search" />,
    X: () => <span data-testid="icon-x" />,
    BarChart3: () => <span data-testid="icon-bar-chart" />,
    AlertCircle: () => <span data-testid="icon-alert" />
  };
});

describe('AI Matches UI Integration', () => {
  let queryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
  });

  afterEach(() => {
    queryClient.clear();
  });

  const renderWithProviders = (ui) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          {ui}
        </MemoryRouter>
      </QueryClientProvider>
    );
  };

  it('renders matches returned by the AI Hybrid strategy with correct scores', async () => {
    renderWithProviders(<Matches />);

    // 1. Switch to 'AI Hybrid' strategy tab
    const hybridTab = screen.getByText('AI Hybrid');
    fireEvent.click(hybridTab);

    // 2. Wait for the mocked AI Match to appear
    // Verify our matched user's name is rendered
    expect(await screen.findByText('Node Ninja')).toBeInTheDocument();

    // 3. Verify the match score is rendered visually (92%)
    expect(screen.getByText('92%')).toBeInTheDocument();
    
    // 4. Verify the skills desired/offered are shown
    expect(screen.getByText(/Express/i)).toBeInTheDocument();
    expect(screen.getByText(/TypeScript/i)).toBeInTheDocument();
  });
});
