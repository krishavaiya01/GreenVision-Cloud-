import React from 'react';
import { vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import RightsizingWidget from '../RightsizingWidget';

const mockGetRightsizing = vi.fn(async (provider = 'aws') => {
  if (provider === 'azure') {
    return {
      success: true,
      data: [
        {
          instanceId: 'azure-1',
          provider: 'azure',
          currentType: 'B2s',
          recommendedType: 'B1s',
          avgCpuUtilization: 10,
          memoryUtilization: 25,
          estimatedMonthlySavings: 12.5,
          reason: 'CPU underutilized'
        }
      ],
      metadata: { instancesAnalyzed: 1, totalEstimatedMonthlySavings: 12.5 }
    };
  }
  return {
    success: true,
    data: [
      {
        instanceId: 'aws-1',
        provider: 'aws',
        currentType: 't3.medium',
        recommendedType: 't3.small',
        avgCpuUtilization: 12.3,
        memoryUtilization: 40,
        estimatedMonthlySavings: 20.5,
        reason: 'CPU underutilized'
      }
    ],
    metadata: { instancesAnalyzed: 1, totalEstimatedMonthlySavings: 20.5 }
  };
});

vi.mock('../../../services/api/aiApi', () => ({
  aiApi: {
    getRightsizing: (...args) => mockGetRightsizing(...args)
  }
}));

const renderWithTheme = (ui) => {
  const theme = createTheme();
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
};

describe('RightsizingWidget', () => {
  beforeEach(() => {
    mockGetRightsizing.mockClear();
  });

  it('renders rightsizing rows and summary chips for default provider', async () => {
    renderWithTheme(<RightsizingWidget defaultProvider="aws" />);

    expect(screen.getByText('Rightsizing Opportunities')).toBeInTheDocument();
    await screen.findByText('aws-1');

    expect(screen.getByText('t3.medium')).toBeInTheDocument();
    expect(screen.getByText('t3.small')).toBeInTheDocument();
    expect(screen.getByText(/Est. Monthly Savings: \$20.50/)).toBeInTheDocument();
    expect(screen.getByText('40.0%')).toBeInTheDocument();
    expect(mockGetRightsizing).toHaveBeenCalledWith('aws');
  });

  it('switches provider and shows new data', async () => {
    renderWithTheme(<RightsizingWidget defaultProvider="aws" />);

    const select = screen.getByRole('button', { name: /aws/i });
    await userEvent.click(select);
    const azureOption = await screen.findByText('Azure');
    await userEvent.click(azureOption);

    await waitFor(() => expect(mockGetRightsizing).toHaveBeenCalledWith('azure'));
    await screen.findByText('azure-1');
    expect(screen.getByText('B2s')).toBeInTheDocument();
    expect(screen.getByText('B1s')).toBeInTheDocument();
    expect(screen.getByText(/Est. Monthly Savings: \$12.50/)).toBeInTheDocument();
  });
});
