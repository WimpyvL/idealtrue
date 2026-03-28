UPDATE platform_settings
SET platform_name = 'Ideal Stay',
    updated_at = NOW()
WHERE id = 'global'
  AND platform_name = 'IdealTrue';
