pause
call build.bat
aws s3 cp dist s3://ae-chat --acl public-read --recursive --cache-control no-cache
pause