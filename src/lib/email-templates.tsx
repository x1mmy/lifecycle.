import React from 'react';

interface Product {
  id: string;
  name: string;
  category: string;
  expiry_date: string;
  quantity: number;
  batch_number?: string;
  supplier?: string;
  location?: string;
  days_until_expiry: number;
}

interface ExpiryAlertEmailProps {
  businessName: string;
  products: Product[];
  alertThreshold: number;
}

interface WeeklyReportEmailProps {
  businessName: string;
  stats: {
    totalProducts: number;
    expiredCount: number;
    expiringSoonCount: number;
    topCategories: { category: string; count: number }[];
  };
  expiringProducts: Product[];
  expiredProducts: Product[];
}

/**
 * Daily Expiry Alert Email Template
 * This template is optimized for daily operational use - clear, actionable, and focused on immediate decisions.
 * Shows all products expiring within the user's alert threshold with clear status indicators.
 */
export const ExpiryAlertEmail: React.FC<ExpiryAlertEmailProps> = ({
  businessName,
  products,
  alertThreshold
}) => {
  const getExpiryStatus = (days: number) => {
    if (days <= 0) return { status: 'Expired', color: '#ef4444', bg: '#fef2f2' };
    if (days <= 3) return { status: 'Urgent', color: '#f59e0b', bg: '#fffbeb' };
    if (days <= 7) return { status: 'Warning', color: '#eab308', bg: '#fefce8' };
    return { status: 'Notice', color: '#6366f1', bg: '#f0f4ff' };
  };

  return (
    <html>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Product Expiry Alert - LifeCycle</title>
        <style>{`
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #374151;
            margin: 0;
            padding: 0;
            background-color: #f9fafb;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          }
          .header {
            background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
            color: white;
            padding: 32px 24px;
            text-align: center;
          }
          .header h1 {
            margin: 0;
            font-size: 24px;
            font-weight: 600;
          }
          .header p {
            margin: 8px 0 0 0;
            opacity: 0.9;
            font-size: 16px;
          }
          .content {
            padding: 32px 24px;
          }
          .alert-summary {
            background-color: #fef2f2;
            border: 1px solid #fecaca;
            border-radius: 6px;
            padding: 16px;
            margin-bottom: 24px;
          }
          .alert-summary h2 {
            color: #dc2626;
            margin: 0 0 8px 0;
            font-size: 18px;
          }
          .alert-summary p {
            margin: 0;
            color: #7f1d1d;
          }
          .products-table {
            width: 100%;
            border-collapse: collapse;
            margin: 24px 0;
          }
          .products-table th {
            background-color: #f3f4f6;
            padding: 12px;
            text-align: left;
            font-weight: 600;
            color: #374151;
            border-bottom: 1px solid #e5e7eb;
          }
          .products-table td {
            padding: 12px;
            border-bottom: 1px solid #e5e7eb;
          }
          .products-table tr:last-child td {
            border-bottom: none;
          }
          .status-badge {
            display: inline-block;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 500;
            text-transform: uppercase;
          }
          .cta-button {
            display: inline-block;
            background-color: #6366f1;
            color: white;
            text-decoration: none;
            padding: 12px 24px;
            border-radius: 6px;
            font-weight: 500;
            margin: 24px 0;
            transition: background-color 0.2s;
          }
          .footer {
            background-color: #f9fafb;
            padding: 24px;
            text-align: center;
            border-top: 1px solid #e5e7eb;
          }
          .footer p {
            margin: 0;
            color: #6b7280;
            font-size: 14px;
          }
          .category-tag {
            background-color: #f0f4ff;
            color: #6366f1;
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 11px;
            font-weight: 500;
          }
        `}</style>
      </head>
      <body>
        <div className="container">
          <div className="header">
            <h1>🚨 Product Expiry Alert</h1>
            <p>Action required for {businessName}</p>
          </div>
          
          <div className="content">
            <div className="alert-summary">
              <h2>⚠️ Attention Required</h2>
              <p>
                You have <strong>{products.length} product{products.length !== 1 ? 's' : ''}</strong> expiring 
                within the next {alertThreshold} days that require your attention.
              </p>
            </div>

            <table className="products-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Category</th>
                  <th>Expiry Date</th>
                  <th>Status</th>
                  <th>Quantity</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => {
                  const statusInfo = getExpiryStatus(product.days_until_expiry);
                  return (
                    <tr key={product.id}>
                      <td>
                        <div>
                          <strong>{product.name}</strong>
                          {product.batch_number && (
                            <div style={{ fontSize: '12px', color: '#6b7280' }}>
                              Batch: {product.batch_number}
                            </div>
                          )}
                        </div>
                      </td>
                      <td>
                        <span className="category-tag">{product.category}</span>
                      </td>
                      <td>{new Date(product.expiry_date).toLocaleDateString()}</td>
                      <td>
                        <span 
                          className="status-badge" 
                          style={{ 
                            backgroundColor: statusInfo.bg, 
                            color: statusInfo.color 
                          }}
                        >
                          {statusInfo.status}
                        </span>
                      </td>
                      <td>{product.quantity}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div style={{ textAlign: 'center', marginTop: '32px' }}>
              <a href="https://app.lifecycle.cloud/dashboard" className="cta-button">
                View Dashboard
              </a>
            </div>

            <p style={{ fontSize: '14px', color: '#6b7280', marginTop: '24px' }}>
              This is an automated alert from LifeCycle. You can manage your notification preferences in your account settings.
            </p>
          </div>

          <div className="footer">
            <p>© 2024 LifeCycle. All rights reserved.</p>
            <p>lifecycle.cloud | Product Lifecycle Management</p>
          </div>
        </div>
      </body>
    </html>
  );
};

/**
 * Weekly Report Email Template
 * This template provides strategic insights and analytics for weekly planning.
 * Includes comprehensive statistics, trends, and retrospective data for informed decision-making.
 */
export const WeeklyReportEmail: React.FC<WeeklyReportEmailProps> = ({
  businessName,
  stats,
  expiringProducts,
  expiredProducts
}) => {
  return (
    <html>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Weekly Report - LifeCycle</title>
        <style>{`
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #374151;
            margin: 0;
            padding: 0;
            background-color: #f9fafb;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          }
          .header {
            background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
            color: white;
            padding: 32px 24px;
            text-align: center;
          }
          .header h1 {
            margin: 0;
            font-size: 24px;
            font-weight: 600;
          }
          .header p {
            margin: 8px 0 0 0;
            opacity: 0.9;
            font-size: 16px;
          }
          .content {
            padding: 32px 24px;
          }
          .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
            gap: 16px;
            margin: 24px 0;
          }
          .stat-card {
            background-color: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            padding: 16px;
            text-align: center;
          }
          .stat-number {
            font-size: 24px;
            font-weight: 700;
            color: #6366f1;
            margin: 0;
          }
          .stat-label {
            font-size: 12px;
            color: #64748b;
            margin: 4px 0 0 0;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .section {
            margin: 32px 0;
          }
          .section h2 {
            color: #1e293b;
            margin: 0 0 16px 0;
            font-size: 18px;
            border-bottom: 2px solid #e2e8f0;
            padding-bottom: 8px;
          }
          .category-list {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin: 16px 0;
          }
          .category-item {
            background-color: #f0f4ff;
            color: #6366f1;
            padding: 6px 12px;
            border-radius: 16px;
            font-size: 12px;
            font-weight: 500;
          }
          .products-table {
            width: 100%;
            border-collapse: collapse;
            margin: 16px 0;
            font-size: 14px;
          }
          .products-table th {
            background-color: #f3f4f6;
            padding: 10px;
            text-align: left;
            font-weight: 600;
            color: #374151;
            border-bottom: 1px solid #e5e7eb;
            font-size: 12px;
          }
          .products-table td {
            padding: 10px;
            border-bottom: 1px solid #e5e7eb;
          }
          .products-table tr:last-child td {
            border-bottom: none;
          }
          .status-badge {
            display: inline-block;
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 10px;
            font-weight: 500;
            text-transform: uppercase;
          }
          .expired { background-color: #fef2f2; color: #dc2626; }
          .expiring { background-color: #fffbeb; color: #f59e0b; }
          .cta-button {
            display: inline-block;
            background-color: #6366f1;
            color: white;
            text-decoration: none;
            padding: 12px 24px;
            border-radius: 6px;
            font-weight: 500;
            margin: 24px 0;
            transition: background-color 0.2s;
          }
          .footer {
            background-color: #f9fafb;
            padding: 24px;
            text-align: center;
            border-top: 1px solid #e5e7eb;
          }
          .footer p {
            margin: 0;
            color: #6b7280;
            font-size: 14px;
          }
          .category-tag {
            background-color: #f0f4ff;
            color: #6366f1;
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 11px;
            font-weight: 500;
          }
        `}</style>
      </head>
      <body>
        <div className="container">
          <div className="header">
            <h1>📊 Weekly Report</h1>
            <p>{businessName} - Week of {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
          </div>
          
          <div className="content">
            <p>Here is your weekly overview of product inventory and expiry status.</p>

            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-number">{stats.totalProducts}</div>
                <div className="stat-label">Total Products</div>
              </div>
              <div className="stat-card">
                <div className="stat-number">{stats.expiredCount}</div>
                <div className="stat-label">Expired</div>
              </div>
              <div className="stat-card">
                <div className="stat-number">{stats.expiringSoonCount}</div>
                <div className="stat-label">Expiring Soon</div>
              </div>
            </div>

            <div className="section">
              <h2>📈 Top Categories</h2>
              <div className="category-list">
                {stats.topCategories.map((cat, index) => (
                  <span key={index} className="category-item">
                    {cat.category} ({cat.count})
                  </span>
                ))}
              </div>
            </div>

            {expiredProducts.length > 0 && (
              <div className="section">
                <h2>❌ Recently Expired Products</h2>
                <table className="products-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Category</th>
                      <th>Expiry Date</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expiredProducts.slice(0, 5).map((product) => (
                      <tr key={product.id}>
                        <td>
                          <strong>{product.name}</strong>
                          {product.batch_number && (
                            <div style={{ fontSize: '11px', color: '#6b7280' }}>
                              Batch: {product.batch_number}
                            </div>
                          )}
                        </td>
                        <td>
                          <span className="category-tag">{product.category}</span>
                        </td>
                        <td>{new Date(product.expiry_date).toLocaleDateString()}</td>
                        <td>
                          <span className="status-badge expired">Expired</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {expiringProducts.length > 0 && (
              <div className="section">
                <h2>⚠️ Products Expiring Soon</h2>
                <table className="products-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Category</th>
                      <th>Expiry Date</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expiringProducts.slice(0, 5).map((product) => (
                      <tr key={product.id}>
                        <td>
                          <strong>{product.name}</strong>
                          {product.batch_number && (
                            <div style={{ fontSize: '11px', color: '#6b7280' }}>
                              Batch: {product.batch_number}
                            </div>
                          )}
                        </td>
                        <td>
                          <span className="category-tag">{product.category}</span>
                        </td>
                        <td>{new Date(product.expiry_date).toLocaleDateString()}</td>
                        <td>
                          <span className="status-badge expiring">
                            {product.days_until_expiry} days
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div style={{ textAlign: 'center', marginTop: '32px' }}>
              <a href="https://app.lifecycle.cloud/dashboard" className="cta-button">
                View Full Dashboard
              </a>
            </div>

            <p style={{ fontSize: '14px', color: '#6b7280', marginTop: '24px' }}>
              This weekly report helps you stay on top of your inventory. You can manage your notification preferences in your account settings.
            </p>
          </div>

          <div className="footer">
            <p>© 2024 LifeCycle. All rights reserved.</p>
            <p>lifecycle.cloud | Product Lifecycle Management</p>
          </div>
        </div>
      </body>
    </html>
  );
};
